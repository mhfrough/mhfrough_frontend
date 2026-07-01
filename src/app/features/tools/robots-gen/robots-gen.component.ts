import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadText } from '../shared/clipboard.util';

interface RobotsGroup {
    userAgent: string;
    allow: string;
    disallow: string;
    crawlDelay: string;
}

@Component({
    selector: 'app-robots-gen',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './robots-gen.component.html',
    styleUrl: './robots-gen.component.scss',
})
export class RobotsGenComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly groups = signal<RobotsGroup[]>([
        { userAgent: '*', allow: '', disallow: '', crawlDelay: '' },
    ]);
    readonly sitemaps = signal('');

    readonly copied = signal(false);

    readonly output = computed(() => {
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

    ngOnInit(): void {
        this.seo.update({
            title: 'robots.txt Generator | Dev Tools',
            description:
                'Compose a robots.txt with user-agent groups, allow/disallow rules, crawl-delay and sitemap lines. Free and browser-only.',
            url: '/tools/robots-txt',
            keywords: 'robots.txt generator, robots txt, allow disallow, crawl-delay, seo robots',
        });
    }

    private splitLines(value: string): string[] {
        return value
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0);
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
        if (!this.output()) return;
        this.api.reportUsage({
            toolId: 'robots-gen',
            action: 'generate',
            metadata: { groups: this.groups().length },
        });
    }

    async copyOutput(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.output();
        if (!out) return;
        if (await copyText(out)) {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 1400);
            this.api.reportUsage({ toolId: 'robots-gen', action: 'copy' });
        }
    }

    downloadOutput(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.output();
        if (!out) return;
        downloadText(out, 'robots.txt', 'text/plain');
        this.api.reportUsage({ toolId: 'robots-gen', action: 'download' });
    }
}
