import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadText } from '../shared/clipboard.util';

@Component({
    selector: 'app-scss-nesting',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './scss-nesting.component.html',
    styleUrl: './scss-nesting.component.scss',
})
export class ScssNestingComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly code = signal('');

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly output = signal<string | null>(null);
    readonly durationMs = signal<number | null>(null);
    readonly copied = signal(false);

    ngOnInit(): void {
        this.seo.update({
            title: 'CSS to Nested SCSS | Dev Tools',
            description:
                'Turn flat CSS with repeated selectors into clean, nested SCSS. Paste your CSS and get organised, nested Sass back instantly.',
            url: '/tools/scss-nesting',
            keywords: 'css to scss nesting, nest css, scss converter, sass nesting',
        });
    }

    nest(): void {
        const code = this.code();
        if (!code.trim()) {
            this.error.set('Paste some flat CSS to nest first.');
            return;
        }
        this.loading.set(true);
        this.error.set(null);
        this.output.set(null);

        this.api.scssNest({ code }).subscribe({
            next: (res) => {
                this.output.set(res.output);
                this.durationMs.set(res.durationMs);
                this.loading.set(false);
                this.api.reportUsage({ toolId: 'scss-nesting', action: 'nest' });
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.message ?? 'Nesting failed. Check your CSS and try again.');
            },
        });
    }

    async copyOutput(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.output();
        if (!out) return;
        if (await copyText(out)) {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 1400);
            this.api.reportUsage({ toolId: 'scss-nesting', action: 'copy' });
        }
    }

    downloadOutput(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.output();
        if (!out) return;
        downloadText(out, 'nested.scss', 'text/x-scss');
        this.api.reportUsage({ toolId: 'scss-nesting', action: 'download' });
    }
}
