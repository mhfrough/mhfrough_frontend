import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadText } from '../shared/clipboard.util';

type Mode = 'encode' | 'decode';

@Component({
    selector: 'app-base64-codec',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './base64-codec.component.html',
    styleUrl: './base64-codec.component.scss',
})
export class Base64CodecComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly mode = signal<Mode>('encode');
    readonly input = signal('');
    readonly output = signal('');

    readonly error = signal<string | null>(null);
    readonly copied = signal(false);
    readonly fileName = signal<string | null>(null);

    ngOnInit(): void {
        this.seo.update({
            title: 'Base64 Encoder / Decoder | Dev Tools',
            description:
                'Encode text and files to Base64 and decode Base64 back to text — Unicode-safe and runs entirely in your browser.',
            url: '/tools/base64-codec',
            keywords: 'base64 encode, base64 decode, base64 converter, file to base64',
        });
    }

    setMode(mode: Mode): void {
        this.mode.set(mode);
        this.error.set(null);
        this.output.set('');
        this.fileName.set(null);
    }

    /** Unicode-safe encode: UTF-8 bytes → Base64. */
    private encodeUtf8(s: string): string {
        return btoa(unescape(encodeURIComponent(s)));
    }

    /** Unicode-safe decode: Base64 → UTF-8 text. Throws on malformed input. */
    private decodeUtf8(s: string): string {
        return decodeURIComponent(escape(atob(s.trim())));
    }

    run(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.error.set(null);
        this.fileName.set(null);
        const src = this.input();
        if (!src.trim()) {
            this.output.set('');
            return;
        }
        try {
            if (this.mode() === 'encode') {
                this.output.set(this.encodeUtf8(src));
            } else {
                this.output.set(this.decodeUtf8(src));
            }
            this.api.reportUsage({ toolId: 'base64-codec', action: this.mode() });
        } catch {
            this.output.set('');
            this.error.set(
                this.mode() === 'decode'
                    ? 'Invalid Base64 — could not decode. Check the input for stray characters.'
                    : 'Could not encode the provided text.',
            );
        }
    }

    swap(): void {
        this.input.set(this.output());
        this.output.set('');
        this.fileName.set(null);
        this.mode.update(m => (m === 'encode' ? 'decode' : 'encode'));
        this.error.set(null);
    }

    /** Read a picked file and emit a Base64 data URL into the output. */
    onFile(event: Event): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        this.error.set(null);
        this.mode.set('encode');

        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            // Strip the data URL prefix to leave raw Base64.
            const comma = result.indexOf(',');
            this.output.set(comma >= 0 ? result.slice(comma + 1) : result);
            this.fileName.set(file.name);
            this.api.reportUsage({
                toolId: 'base64-codec',
                action: 'encode-file',
                metadata: { size: file.size, type: file.type },
            });
        };
        reader.onerror = () => this.error.set('Could not read that file.');
        reader.readAsDataURL(file);
        // Allow re-selecting the same file.
        input.value = '';
    }

    async copyOutput(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.output();
        if (!out) return;
        if (await copyText(out)) {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 1400);
            this.api.reportUsage({ toolId: 'base64-codec', action: 'copy' });
        }
    }

    downloadOutput(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.output();
        if (!out) return;
        const name = this.mode() === 'decode' ? 'decoded.txt' : 'encoded.base64.txt';
        downloadText(out, name);
        this.api.reportUsage({ toolId: 'base64-codec', action: 'download' });
    }
}
