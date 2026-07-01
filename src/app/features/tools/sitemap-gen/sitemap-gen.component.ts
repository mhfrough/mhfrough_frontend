import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadText } from '../shared/clipboard.util';

type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

@Component({
    selector: 'app-sitemap-gen',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './sitemap-gen.component.html',
    styleUrl: './sitemap-gen.component.scss',
})
export class SitemapGenComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly urls = signal('');
    readonly changefreq = signal<ChangeFreq>('weekly');
    readonly priority = signal(0.5);
    readonly lastmod = signal('');
    readonly includeLastmod = signal(false);

    readonly copied = signal(false);

    readonly changeFreqs: ChangeFreq[] = [
        'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never',
    ];

    readonly urlCount = computed(() => this.parseUrls().length);

    readonly output = computed(() => {
        const list = this.parseUrls();
        if (!list.length) return '';
        const freq = this.changefreq();
        const prio = this.priority().toFixed(1);
        const lastmod = this.includeLastmod() ? this.lastmod().trim() : '';

        const lines: string[] = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ];
        for (const loc of list) {
            lines.push('  <url>');
            lines.push(`    <loc>${this.escapeXml(loc)}</loc>`);
            if (lastmod) lines.push(`    <lastmod>${this.escapeXml(lastmod)}</lastmod>`);
            lines.push(`    <changefreq>${freq}</changefreq>`);
            lines.push(`    <priority>${prio}</priority>`);
            lines.push('  </url>');
        }
        lines.push('</urlset>');
        return lines.join('\n');
    });

    ngOnInit(): void {
        this.seo.update({
            title: 'Sitemap Generator | Dev Tools',
            description:
                'Generate a valid sitemap.xml from a list of URLs with changefreq, priority and lastmod. Free, runs in your browser.',
            url: '/tools/sitemap',
            keywords: 'sitemap generator, sitemap.xml, xml sitemap, seo sitemap',
        });
    }

    private parseUrls(): string[] {
        return this.urls()
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0);
    }

    private escapeXml(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    generate(): void {
        // Output recomputes live; this records the explicit action.
        if (!this.urlCount()) return;
        this.api.reportUsage({
            toolId: 'sitemap-gen',
            action: 'generate',
            metadata: { count: this.urlCount() },
        });
    }

    async copyOutput(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.output();
        if (!out) return;
        if (await copyText(out)) {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 1400);
            this.api.reportUsage({ toolId: 'sitemap-gen', action: 'copy' });
        }
    }

    downloadOutput(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.output();
        if (!out) return;
        downloadText(out, 'sitemap.xml', 'application/xml');
        this.api.reportUsage({ toolId: 'sitemap-gen', action: 'download' });
    }
}
