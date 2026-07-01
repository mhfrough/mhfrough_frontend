import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

type Tab = 'decode' | 'encode';
type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512';

@Component({
    selector: 'app-jwt-codec',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './jwt-codec.component.html',
    styleUrl: './jwt-codec.component.scss',
})
export class JwtCodecComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly tab = signal<Tab>('decode');

    // --- Decode (client-side) ----------------------------------------------
    readonly token = signal('');
    readonly header = signal<string | null>(null);
    readonly payload = signal<string | null>(null);
    readonly alg = signal<string | null>(null);
    readonly issuedAt = signal<string | null>(null);
    readonly expiresAt = signal<string | null>(null);
    readonly decodeError = signal<string | null>(null);
    readonly copiedDecode = signal(false);

    // --- Encode (backend) --------------------------------------------------
    readonly payloadInput = signal('{\n  "sub": "1234567890",\n  "name": "Jane Doe"\n}');
    readonly secret = signal('');
    readonly algorithm = signal<JwtAlgorithm>('HS256');
    readonly expiresIn = signal('');
    readonly loading = signal(false);
    readonly encodeError = signal<string | null>(null);
    readonly resultToken = signal<string | null>(null);
    readonly copiedEncode = signal(false);

    readonly algorithms: JwtAlgorithm[] = ['HS256', 'HS384', 'HS512'];

    ngOnInit(): void {
        this.seo.update({
            title: 'JWT Encoder / Decoder | Dev Tools',
            description:
                'Decode and inspect JSON Web Tokens in your browser, or sign a new JWT with HS256/384/512. Free online JWT tool.',
            url: '/tools/jwt-codec',
            keywords: 'jwt decoder, jwt encoder, decode jwt, json web token, jwt sign',
        });
    }

    setTab(tab: Tab): void {
        this.tab.set(tab);
    }

    // --- Decode helpers ----------------------------------------------------
    /** Decode a base64url segment to a UTF-8 string (browser-only). */
    private base64UrlDecode(segment: string): string {
        let b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4;
        if (pad) b64 += '='.repeat(4 - pad);
        return decodeURIComponent(escape(atob(b64)));
    }

    private humanize(seconds: unknown): string | null {
        if (typeof seconds !== 'number' || !isFinite(seconds)) return null;
        const d = new Date(seconds * 1000);
        if (isNaN(d.getTime())) return null;
        return d.toUTCString();
    }

    decode(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.decodeError.set(null);
        this.header.set(null);
        this.payload.set(null);
        this.alg.set(null);
        this.issuedAt.set(null);
        this.expiresAt.set(null);

        const raw = this.token().trim();
        if (!raw) {
            this.decodeError.set('Paste a JWT to decode first.');
            return;
        }
        const parts = raw.split('.');
        if (parts.length < 2) {
            this.decodeError.set('Malformed token — a JWT has three dot-separated parts.');
            return;
        }
        try {
            const headerObj = JSON.parse(this.base64UrlDecode(parts[0]));
            const payloadObj = JSON.parse(this.base64UrlDecode(parts[1]));
            this.header.set(JSON.stringify(headerObj, null, 2));
            this.payload.set(JSON.stringify(payloadObj, null, 2));
            this.alg.set(typeof headerObj?.alg === 'string' ? headerObj.alg : null);
            this.issuedAt.set(this.humanize(payloadObj?.iat));
            this.expiresAt.set(this.humanize(payloadObj?.exp));
            this.api.reportUsage({ toolId: 'jwt-codec', action: 'decode' });
        } catch {
            this.decodeError.set('Could not decode — the header or payload is not valid base64url JSON.');
        }
    }

    async copyDecoded(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const p = this.payload();
        if (!p) return;
        if (await copyText(p)) {
            this.copiedDecode.set(true);
            setTimeout(() => this.copiedDecode.set(false), 1400);
            this.api.reportUsage({ toolId: 'jwt-codec', action: 'copy-decoded' });
        }
    }

    // --- Encode ------------------------------------------------------------
    encode(): void {
        const secret = this.secret();
        if (!secret) {
            this.encodeError.set('A secret is required to sign the token.');
            return;
        }
        // Parse payload as JSON object; fall back to the raw string.
        let payload: Record<string, unknown> | string;
        const raw = this.payloadInput().trim();
        try {
            const parsed = JSON.parse(raw);
            payload = parsed && typeof parsed === 'object' ? parsed : raw;
        } catch {
            payload = raw;
        }

        this.loading.set(true);
        this.encodeError.set(null);
        this.resultToken.set(null);

        const expiresIn = this.expiresIn().trim();
        this.api.jwtEncode({
            payload,
            secret,
            algorithm: this.algorithm(),
            ...(expiresIn ? { expiresIn } : {}),
        }).subscribe({
            next: (res) => {
                this.resultToken.set(res.token);
                this.loading.set(false);
                this.api.reportUsage({
                    toolId: 'jwt-codec',
                    action: 'encode',
                    metadata: { algorithm: this.algorithm() },
                });
            },
            error: (err) => {
                this.loading.set(false);
                this.encodeError.set(err?.error?.message ?? 'Signing failed. Check your payload and secret.');
            },
        });
    }

    async copyToken(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const t = this.resultToken();
        if (!t) return;
        if (await copyText(t)) {
            this.copiedEncode.set(true);
            setTimeout(() => this.copiedEncode.set(false), 1400);
            this.api.reportUsage({ toolId: 'jwt-codec', action: 'copy-token' });
        }
    }
}
