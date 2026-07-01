import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, MinifyLanguage, MinifyResponse } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadText } from '../shared/clipboard.util';

interface OptionDef {
    key: string;
    label: string;
}

@Component({
    selector: 'app-minify',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './minify.component.html',
    styleUrl: './minify.component.scss',
})
export class MinifyComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly language = signal<MinifyLanguage>('html');
    readonly code = signal('');

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly result = signal<MinifyResponse | null>(null);
    readonly copied = signal(false);

    // Option checkboxes per language.
    private readonly optionDefs: Record<MinifyLanguage, OptionDef[]> = {
        html: [
            { key: 'collapseWhitespace', label: 'Collapse whitespace' },
            { key: 'removeComments', label: 'Remove comments' },
            { key: 'minifyCSS', label: 'Minify inline CSS' },
            { key: 'minifyJS', label: 'Minify inline JS' },
        ],
        css: [
            { key: 'removeComments', label: 'Remove comments' },
        ],
        js: [
            { key: 'removeComments', label: 'Remove comments' },
        ],
    };

    // Per-language option state, defaulting everything on.
    readonly options = signal<Record<string, boolean>>({
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
    });

    readonly currentOptions = computed(() => this.optionDefs[this.language()]);

    readonly outputBytes = computed(() => this.result()?.bytesOut ?? 0);

    ngOnInit(): void {
        this.seo.update({
            title: 'HTML / CSS / JS Minifier | Dev Tools',
            description:
                'Minify HTML, CSS and JavaScript and see exactly how many bytes you saved. Free online code minifier.',
            url: '/tools/minify',
            keywords: 'html minifier, css minifier, js minifier, javascript minify, code minify',
        });
    }

    setLanguage(lang: MinifyLanguage): void {
        this.language.set(lang);
        this.result.set(null);
        this.error.set(null);
    }

    toggleOption(key: string, checked: boolean): void {
        this.options.update(o => ({ ...o, [key]: checked }));
    }

    minify(): void {
        const code = this.code();
        if (!code.trim()) {
            this.error.set('Paste some code to minify first.');
            return;
        }
        // Only send options relevant to the active language.
        const opts: Record<string, boolean> = {};
        for (const def of this.currentOptions()) opts[def.key] = !!this.options()[def.key];

        this.loading.set(true);
        this.error.set(null);
        this.result.set(null);

        this.api.minify({ language: this.language(), code, options: opts }).subscribe({
            next: (res) => {
                this.result.set(res);
                this.loading.set(false);
                this.api.reportUsage({
                    toolId: 'minify',
                    action: 'minify',
                    metadata: { language: this.language(), savedPct: res.savedPct },
                });
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.message ?? 'Minification failed. Check your input and try again.');
            },
        });
    }

    async copyOutput(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.result()?.output;
        if (!out) return;
        if (await copyText(out)) {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 1400);
            this.api.reportUsage({ toolId: 'minify', action: 'copy' });
        }
    }

    downloadOutput(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.result()?.output;
        if (!out) return;
        const ext = this.language() === 'js' ? 'js' : this.language();
        const mime = this.language() === 'html' ? 'text/html'
            : this.language() === 'css' ? 'text/css' : 'text/javascript';
        downloadText(out, `minified.min.${ext}`, mime);
        this.api.reportUsage({ toolId: 'minify', action: 'download' });
    }
}
