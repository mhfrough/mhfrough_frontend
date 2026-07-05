import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadText } from '../shared/clipboard.util';

type Codec = 'url' | 'base64' | 'hex' | 'html';
type Mode = 'encode' | 'decode';
type Scope = 'component' | 'full';

@Component({
    selector: 'app-url-codec',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './url-codec.component.html',
    styleUrl: './url-codec.component.scss',
})
export class UrlCodecComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    /** Top-level codec mode. */
    readonly codec = signal<Codec>('url');

    // --- URL mode state ------------------------------------------------------
    readonly mode = signal<Mode>('encode');
    /** component = encodeURIComponent (encodes &?=#…), full = encodeURI (preserves URL chars). */
    readonly scope = signal<Scope>('component');
    readonly input = signal('');

    readonly error = signal<string | null>(null);
    readonly copied = signal(false);

    readonly output = computed(() => {
        const src = this.input();
        if (!src) return '';
        try {
            if (this.mode() === 'encode') {
                return this.scope() === 'component'
                    ? encodeURIComponent(src)
                    : encodeURI(src);
            }
            return this.scope() === 'component'
                ? decodeURIComponent(src)
                : decodeURI(src);
        } catch {
            return '';
        }
    });

    // --- Base64 mode state -----------------------------------------------------
    readonly b64Mode = signal<Mode>('encode');
    readonly b64Input = signal('');
    readonly b64Output = signal('');
    readonly b64Error = signal<string | null>(null);
    readonly b64Copied = signal(false);
    readonly b64FileName = signal<string | null>(null);

    // --- Hex mode state ----------------------------------------------------
    readonly hexMode = signal<Mode>('encode');
    readonly hexInput = signal('');
    readonly hexError = signal<string | null>(null);
    readonly hexCopied = signal(false);

    readonly hexOutput = computed(() => {
        const src = this.hexInput();
        if (!src) return '';
        try {
            if (this.hexMode() === 'encode') {
                return Array.from(new TextEncoder().encode(src))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            }
            const cleaned = src.trim().replace(/\s+/g, '');
            const pairs = cleaned.match(/.{1,2}/g);
            if (!pairs || cleaned.length % 2 !== 0) throw new Error('bad hex');
            const bytes = pairs.map(h => {
                const n = parseInt(h, 16);
                if (isNaN(n)) throw new Error('bad hex');
                return n;
            });
            return new TextDecoder().decode(new Uint8Array(bytes));
        } catch {
            return '';
        }
    });

    // --- HTML entity mode state ----------------------------------------------
    readonly htmlMode = signal<Mode>('encode');
    readonly htmlInput = signal('');
    readonly htmlError = signal<string | null>(null);
    readonly htmlCopied = signal(false);

    private static readonly HTML_ENCODE_MAP: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    };

    private static readonly HTML_DECODE_MAP: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
    };

    readonly htmlOutput = computed(() => {
        const src = this.htmlInput();
        if (!src) return '';
        if (this.htmlMode() === 'encode') {
            return src.replace(/[&<>"']/g, ch => UrlCodecComponent.HTML_ENCODE_MAP[ch]);
        }
        // Decode named + numeric entities. Named/simple numeric via regex; full
        // fidelity (all named entities) via the browser DOM when available.
        if (isPlatformBrowser(this.platformId)) {
            try {
                const el = document.createElement('textarea');
                el.innerHTML = src;
                return el.textContent ?? '';
            } catch {
                // fall through to manual decode below
            }
        }
        return src
            .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
            .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
            .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, m => UrlCodecComponent.HTML_DECODE_MAP[m]);
    });

    ngOnInit(): void {
        this.seo.update({
            title: 'Encode / Decode Toolkit | Dev Tools',
            description:
                'Encode and decode URL components, Base64, hex and HTML entities in one place. Free, runs entirely in your browser.',
            url: '/tools/url-codec',
            keywords: 'url encode, url decode, base64 encode, base64 decode, hex encode, hex decode, html entities, encodeuricomponent',
        });
    }

    /** Error for whichever codec mode is currently active — surfaced in the shared tool-page alert. */
    readonly activeError = computed(() => {
        switch (this.codec()) {
            case 'url': return this.error();
            case 'base64': return this.b64Error();
            case 'hex': return this.hexError();
            case 'html': return this.htmlError();
        }
    });

    setCodec(codec: Codec): void {
        this.codec.set(codec);
    }

    // --- URL mode methods ------------------------------------------------------
    setMode(mode: Mode): void {
        this.mode.set(mode);
        this.error.set(null);
    }

    /** Validate decode input on demand and record the action. */
    run(): void {
        this.error.set(null);
        if (this.mode() === 'decode' && this.input()) {
            try {
                if (this.scope() === 'component') decodeURIComponent(this.input());
                else decodeURI(this.input());
            } catch {
                this.error.set('Malformed input — could not decode. Check for stray % sequences.');
                return;
            }
        }
        this.api.reportUsage({
            toolId: 'url-codec',
            action: this.mode() === 'encode' ? 'url-encode' : 'url-decode',
            metadata: { scope: this.scope() },
        });
    }

    swap(): void {
        // Move output into input and flip the direction.
        const out = this.output();
        this.input.set(out);
        this.mode.update(m => (m === 'encode' ? 'decode' : 'encode'));
        this.error.set(null);
    }

    async copyOutput(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.output();
        if (!out) return;
        if (await copyText(out)) {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 1400);
            this.api.reportUsage({ toolId: 'url-codec', action: 'copy' });
        }
    }

    // --- Base64 mode methods -----------------------------------------------
    setB64Mode(mode: Mode): void {
        this.b64Mode.set(mode);
        this.b64Error.set(null);
        this.b64Output.set('');
        this.b64FileName.set(null);
    }

    /** Unicode-safe encode: UTF-8 bytes → Base64. */
    private encodeUtf8(s: string): string {
        return btoa(unescape(encodeURIComponent(s)));
    }

    /** Unicode-safe decode: Base64 → UTF-8 text. Throws on malformed input. */
    private decodeUtf8(s: string): string {
        return decodeURIComponent(escape(atob(s.trim())));
    }

    runB64(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.b64Error.set(null);
        this.b64FileName.set(null);
        const src = this.b64Input();
        if (!src.trim()) {
            this.b64Output.set('');
            return;
        }
        try {
            if (this.b64Mode() === 'encode') {
                this.b64Output.set(this.encodeUtf8(src));
            } else {
                this.b64Output.set(this.decodeUtf8(src));
            }
            this.api.reportUsage({
                toolId: 'url-codec',
                action: this.b64Mode() === 'encode' ? 'base64-encode' : 'base64-decode',
            });
        } catch {
            this.b64Output.set('');
            this.b64Error.set(
                this.b64Mode() === 'decode'
                    ? 'Invalid Base64 — could not decode. Check the input for stray characters.'
                    : 'Could not encode the provided text.',
            );
        }
    }

    swapB64(): void {
        this.b64Input.set(this.b64Output());
        this.b64Output.set('');
        this.b64FileName.set(null);
        this.b64Mode.update(m => (m === 'encode' ? 'decode' : 'encode'));
        this.b64Error.set(null);
    }

    /** Read a picked file and emit a Base64 data URL into the output. */
    onFile(event: Event): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        this.b64Error.set(null);
        this.b64Mode.set('encode');

        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            // Strip the data URL prefix to leave raw Base64.
            const comma = result.indexOf(',');
            this.b64Output.set(comma >= 0 ? result.slice(comma + 1) : result);
            this.b64FileName.set(file.name);
            this.api.reportUsage({
                toolId: 'url-codec',
                action: 'base64-encode-file',
                metadata: { size: file.size, type: file.type },
            });
        };
        reader.onerror = () => this.b64Error.set('Could not read that file.');
        reader.readAsDataURL(file);
        // Allow re-selecting the same file.
        input.value = '';
    }

    async copyB64Output(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.b64Output();
        if (!out) return;
        if (await copyText(out)) {
            this.b64Copied.set(true);
            setTimeout(() => this.b64Copied.set(false), 1400);
            this.api.reportUsage({ toolId: 'url-codec', action: 'copy' });
        }
    }

    downloadB64Output(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.b64Output();
        if (!out) return;
        const name = this.b64Mode() === 'decode' ? 'decoded.txt' : 'encoded.base64.txt';
        downloadText(out, name);
        this.api.reportUsage({ toolId: 'url-codec', action: 'download' });
    }

    // --- Hex mode methods ----------------------------------------------------
    setHexMode(mode: Mode): void {
        this.hexMode.set(mode);
        this.hexError.set(null);
    }

    runHex(): void {
        this.hexError.set(null);
        if (this.hexMode() === 'decode' && this.hexInput()) {
            try {
                const cleaned = this.hexInput().trim().replace(/\s+/g, '');
                const pairs = cleaned.match(/.{1,2}/g);
                if (!pairs || cleaned.length % 2 !== 0) throw new Error('bad hex');
                const bytes = pairs.map(h => {
                    const n = parseInt(h, 16);
                    if (isNaN(n)) throw new Error('bad hex');
                    return n;
                });
                new TextDecoder().decode(new Uint8Array(bytes));
            } catch {
                this.hexError.set('Malformed hex — expected pairs of hex digits (0-9, a-f).');
                return;
            }
        }
        this.api.reportUsage({
            toolId: 'url-codec',
            action: this.hexMode() === 'encode' ? 'hex-encode' : 'hex-decode',
        });
    }

    swapHex(): void {
        const out = this.hexOutput();
        this.hexInput.set(out);
        this.hexMode.update(m => (m === 'encode' ? 'decode' : 'encode'));
        this.hexError.set(null);
    }

    async copyHexOutput(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.hexOutput();
        if (!out) return;
        if (await copyText(out)) {
            this.hexCopied.set(true);
            setTimeout(() => this.hexCopied.set(false), 1400);
            this.api.reportUsage({ toolId: 'url-codec', action: 'copy' });
        }
    }

    // --- HTML entity mode methods --------------------------------------------
    setHtmlMode(mode: Mode): void {
        this.htmlMode.set(mode);
        this.htmlError.set(null);
    }

    runHtml(): void {
        this.htmlError.set(null);
        this.api.reportUsage({
            toolId: 'url-codec',
            action: this.htmlMode() === 'encode' ? 'html-entity-encode' : 'html-entity-decode',
        });
    }

    swapHtml(): void {
        const out = this.htmlOutput();
        this.htmlInput.set(out);
        this.htmlMode.update(m => (m === 'encode' ? 'decode' : 'encode'));
        this.htmlError.set(null);
    }

    async copyHtmlOutput(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.htmlOutput();
        if (!out) return;
        if (await copyText(out)) {
            this.htmlCopied.set(true);
            setTimeout(() => this.htmlCopied.set(false), 1400);
            this.api.reportUsage({ toolId: 'url-codec', action: 'copy' });
        }
    }
}
