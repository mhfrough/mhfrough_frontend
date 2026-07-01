import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, SeoResponse } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';

type CountState = 'good' | 'warn';

@Component({
    selector: 'app-seo-tools',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './seo-tools.component.html',
    styleUrl: './seo-tools.component.scss',
})
export class SeoToolsComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);

    readonly url = signal('');

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly report = signal<SeoResponse | null>(null);

    /** Convenience: stable key/value pairs for the OG + Twitter tables. */
    readonly ogRows = computed(() => this.toRows(this.report()?.og));
    readonly twitterRows = computed(() => this.toRows(this.report()?.twitter));

    ngOnInit(): void {
        this.seo.update({
            title: 'SEO Audit Tool | Dev Tools',
            description:
                'Audit any page for on-page SEO: title and meta description length, canonical, robots, Open Graph and Twitter cards, H1s, image alt coverage and a prioritised issues list.',
            url: '/tools/seo-tools',
            keywords: 'seo audit, meta tag checker, open graph, twitter card, on-page seo, seo analyzer',
        });
    }

    audit(): void {
        const url = this.url().trim();
        if (!url) {
            this.error.set('Enter a page URL to audit.');
            return;
        }
        this.loading.set(true);
        this.error.set(null);
        this.report.set(null);

        this.api.seo(url).subscribe({
            next: (res) => {
                this.report.set(res);
                this.loading.set(false);
                this.api.reportUsage({ toolId: 'seo-tools', action: 'audit' });
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.message ?? "Couldn't reach that URL. Check the address and try again.");
            },
        });
    }

    /** Title sweet-spot 30–60 chars; outside that we flag a warning. */
    titleState(len: number): CountState {
        return len >= 30 && len <= 60 ? 'good' : 'warn';
    }

    /** Description sweet-spot 70–160 chars. */
    descriptionState(len: number): CountState {
        return len >= 70 && len <= 160 ? 'good' : 'warn';
    }

    private toRows(map: Record<string, string> | undefined): { key: string; value: string }[] {
        if (!map) return [];
        return Object.entries(map).map(([key, value]) => ({ key, value }));
    }
}
