import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadText } from '../shared/clipboard.util';

type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
type Mode = 'sitemap' | 'robots';

interface RobotsGroup {
    userAgent: string;
    allow: string;
    disallow: string;
    crawlDelay: string;
}

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

    readonly mode = signal<Mode>('sitemap');

    // --- sitemap.xml ------------------------------------------------------------
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

    readonly sitemapOutput = computed(() => {
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

    // --- robots.txt ---------------------------------------------------------------
    readonly groups = signal<RobotsGroup[]>([
        { userAgent: '*', allow: '', disallow: '', crawlDelay: '' },
    ]);
    readonly sitemaps = signal('');

    readonly robotsOutput = computed(() => {
        const blocks: string[] = [];
        for (const g of this.groups()) {
            const ua = g.userAgent.trim() || '*';
            const lines: string[] = [`User-agent: ${ua}`];
            for (const path of this.splitLines(g.allow)) lines.push(`Allow: ${path}`);
            for (const path of this.splitLines(g.disallow)) lines.push(`Disallow: ${path}`);
            const delay = g.crawlDelay.trim();
            if (delay) lines.push(`Crawl-delay: ${delay}`);
            blocks.push(lines.join('\n'));
        }
        let out = blocks.join('\n\n');
        const maps = this.splitLines(this.sitemaps());
        if (maps.length) {
            out += (out ? '\n\n' : '') + maps.map(m => `Sitemap: ${m}`).join('\n');
        }
        return out;
    });

    /** Output for whichever mode is active — used by the shared copy/download actions. */
    readonly output = computed(() => this.mode() === 'sitemap' ? this.sitemapOutput() : this.robotsOutput());

    ngOnInit(): void {
        this.seo.update({
            title: 'Sitemap & robots.txt Generator | Dev Tools',
            description:
                'Generate a valid sitemap.xml from a list of URLs, and compose a matching robots.txt with user-agent groups, allow/disallow rules, crawl-delay and sitemap lines. Free, runs in your browser.',
            url: '/tools/sitemap',
            keywords: 'sitemap generator, sitemap.xml, xml sitemap, robots.txt generator, robots txt, seo sitemap',
        });
    }

    setMode(mode: Mode): void {
        this.mode.set(mode);
    }

    private parseUrls(): string[] {
        return this.urls()
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0);
    }

    private splitLines(value: string): string[] {
        return value
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

    addGroup(): void {
        this.groups.update(g => [...g, { userAgent: '*', allow: '', disallow: '', crawlDelay: '' }]);
    }

    removeGroup(index: number): void {
        this.groups.update(g => g.filter((_, i) => i !== index));
    }

    updateGroup(index: number, key: keyof RobotsGroup, value: string): void {
        this.groups.update(groups =>
            groups.map((g, i) => (i === index ? { ...g, [key]: value } : g)),
        );
    }

    generate(): void {
        // Output recomputes live; this records the explicit action.
        if (this.mode() === 'sitemap') {
            if (!this.urlCount()) return;
            this.api.reportUsage({
                toolId: 'sitemap-gen',
                action: 'generate',
                metadata: { mode: 'sitemap', count: this.urlCount() },
            });
        } else {
            if (!this.robotsOutput()) return;
            this.api.reportUsage({
                toolId: 'sitemap-gen',
                action: 'generate',
                metadata: { mode: 'robots', groups: this.groups().length },
            });
        }
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
        if (this.mode() === 'sitemap') {
            downloadText(out, 'sitemap.xml', 'application/xml');
        } else {
            downloadText(out, 'robots.txt', 'text/plain');
        }
        this.api.reportUsage({ toolId: 'sitemap-gen', action: 'download' });
    }
}
