import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

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

    ngOnInit(): void {
        this.seo.update({
            title: 'URL Encoder / Decoder | Dev Tools',
            description:
                'Encode and decode URLs and URL components safely with encodeURIComponent or encodeURI. Free, runs entirely in your browser.',
            url: '/tools/url-codec',
            keywords: 'url encode, url decode, encodeuricomponent, encodeuri, percent encoding',
        });
    }

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
            action: this.mode(),
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
}
