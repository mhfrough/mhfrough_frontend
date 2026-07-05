import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadText } from '../shared/clipboard.util';

type IdType = 'uuid' | 'ulid' | 'hex' | 'nano';

/** Crockford base32 — no I, L, O, U (visually ambiguous). */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const NANO_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

@Component({
    selector: 'app-uuid-gen',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './uuid-gen.component.html',
    styleUrl: './uuid-gen.component.scss',
})
export class UuidGenComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly type = signal<IdType>('uuid');
    readonly count = signal(5);
    readonly uppercase = signal(false);
    readonly noDashes = signal(false);
    readonly hexLength = signal(32);

    readonly ids = signal<string[]>([]);
    readonly error = signal<string | null>(null);
    readonly copiedIndex = signal<number | null>(null);
    readonly copiedAll = signal(false);

    readonly hexLengths = [16, 32, 64];

    readonly typeTabs: { id: IdType; label: string }[] = [
        { id: 'uuid', label: 'UUID v4' },
        { id: 'ulid', label: 'ULID' },
        { id: 'hex', label: 'Random hex' },
        { id: 'nano', label: 'NanoID-style' },
    ];

    ngOnInit(): void {
        this.seo.update({
            title: 'UUID / ULID Generator | Dev Tools',
            description:
                'Generate UUID v4s, ULIDs, random hex strings and NanoID-style IDs in bulk with cryptographically secure randomness.',
            url: '/tools/uuid',
            keywords: 'uuid generator, ulid generator, random id, nanoid, guid generator',
        });
    }

    setType(t: IdType): void {
        if (this.type() === t) return;
        this.type.set(t);
        this.ids.set([]);
        this.error.set(null);
    }

    generate(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        // Predictable IDs are a hazard if users treat them as tokens — refuse to
        // fall back to Math.random rather than silently degrade.
        if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
            this.error.set('Secure randomness (Web Crypto) is unavailable in this browser — refusing to generate weak IDs.');
            return;
        }
        this.error.set(null);
        const n = Math.min(100, Math.max(1, Math.floor(Number(this.count()) || 1)));

        const out: string[] = [];
        for (let i = 0; i < n; i++) {
            let id: string;
            switch (this.type()) {
                case 'uuid': id = this.uuid(); break;
                case 'ulid': id = this.ulid(); break;
                case 'hex': id = this.randomHex(this.hexLength()); break;
                case 'nano': id = this.nano(21); break;
            }
            if (this.type() === 'uuid' && this.noDashes()) id = id.replace(/-/g, '');
            if (this.uppercase()) id = id.toUpperCase();
            out.push(id);
        }
        this.ids.set(out);
        this.api.reportUsage({ toolId: 'uuid-gen', action: this.type(), metadata: { count: n } });
    }

    async copyOne(index: number): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        if (await copyText(this.ids()[index])) {
            this.copiedIndex.set(index);
            setTimeout(() => this.copiedIndex.set(null), 1400);
        }
    }

    async copyAll(): Promise<void> {
        if (!isPlatformBrowser(this.platformId) || !this.ids().length) return;
        if (await copyText(this.ids().join('\n'))) {
            this.copiedAll.set(true);
            setTimeout(() => this.copiedAll.set(false), 1400);
            this.api.reportUsage({ toolId: 'uuid-gen', action: 'copy-all' });
        }
    }

    download(): void {
        if (!isPlatformBrowser(this.platformId) || !this.ids().length) return;
        downloadText(this.ids().join('\n'), 'ids.txt');
        this.api.reportUsage({ toolId: 'uuid-gen', action: 'download' });
    }

    // --- Generators ------------------------------------------------------------

    private uuid(): string {
        if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        const b = new Uint8Array(16);
        crypto.getRandomValues(b);
        b[6] = (b[6] & 0x0f) | 0x40; // version 4
        b[8] = (b[8] & 0x3f) | 0x80; // variant 10
        const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
        return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
    }

    /** 48-bit ms timestamp + 80 random bits, Crockford base32. Within-ms monotonicity is NOT implemented. */
    private ulid(): string {
        let ts = Date.now();
        let time = '';
        for (let i = 0; i < 10; i++) {
            time = CROCKFORD[ts % 32] + time;
            ts = Math.floor(ts / 32);
        }
        const rand = new Uint8Array(10);
        crypto.getRandomValues(rand);
        let random = '';
        // 80 random bits → 16 base32 chars (5 bits each).
        let bits = 0;
        let acc = 0;
        for (const byte of rand) {
            acc = (acc << 8) | byte;
            bits += 8;
            while (bits >= 5) {
                bits -= 5;
                random += CROCKFORD[(acc >>> bits) & 31];
            }
        }
        return time + random;
    }

    private randomHex(length: number): string {
        const bytes = new Uint8Array(Math.ceil(length / 2));
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
    }

    /** Rejection sampling keeps the distribution uniform across the 64-char alphabet. */
    private nano(length: number): string {
        let id = '';
        while (id.length < length) {
            const bytes = new Uint8Array(length * 2);
            crypto.getRandomValues(bytes);
            for (const byte of bytes) {
                if (byte < 192 && id.length < length) {
                    id += NANO_ALPHABET[byte % 64];
                }
            }
        }
        return id;
    }
}
