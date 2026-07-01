import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, ExtractResponse } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

@Component({
    selector: 'app-design-extractor',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './design-extractor.component.html',
    styleUrl: './design-extractor.component.scss',
})
export class DesignExtractorComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly url = signal('');

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly result = signal<ExtractResponse | null>(null);
    readonly copiedHex = signal<string | null>(null);

    ngOnInit(): void {
        this.seo.update({
            title: 'Website Design Extractor | Dev Tools',
            description:
                'Extract the colour palette, font families and page metadata from any public website. Paste a URL and pull its design tokens in seconds.',
            url: '/tools/design-extractor',
            keywords: 'extract website colors, font extractor, design tokens, website palette, css inspector',
        });
    }

    extract(): void {
        const url = this.url().trim();
        if (!url) {
            this.error.set('Enter a website URL to extract from.');
            return;
        }
        this.loading.set(true);
        this.error.set(null);
        this.result.set(null);

        this.api.extract(url).subscribe({
            next: (res) => {
                this.result.set(res);
                this.loading.set(false);
                this.api.reportUsage({ toolId: 'design-extractor', action: 'extract' });
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.message ?? "Couldn't reach that URL. Check the address and try again.");
            },
        });
    }

    async copyHex(hex: string): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        if (await copyText(hex)) {
            this.copiedHex.set(hex);
            setTimeout(() => this.copiedHex.set(null), 1400);
            this.api.reportUsage({ toolId: 'design-extractor', action: 'copy' });
        }
    }
}
