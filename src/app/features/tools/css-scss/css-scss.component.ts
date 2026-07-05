import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, CssDialect } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadText } from '../shared/clipboard.util';

type Direction = 'css-to-scss' | 'scss-to-css';
type Mode = 'convert' | 'nest';

@Component({
    selector: 'app-css-scss',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './css-scss.component.html',
    styleUrl: './css-scss.component.scss',
})
export class CssScssComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly mode = signal<Mode>('convert');

    readonly direction = signal<Direction>('css-to-scss');
    readonly minifyOutput = signal(false);
    readonly code = signal('');

    /** Separate input for the auto-nest mode so switching modes doesn't clobber either draft. */
    readonly nestCode = signal('');

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly output = signal<string | null>(null);
    readonly durationMs = signal<number | null>(null);
    readonly copied = signal(false);

    readonly from = computed<CssDialect>(() => this.direction() === 'css-to-scss' ? 'css' : 'scss');
    readonly to = computed<CssDialect>(() => this.direction() === 'css-to-scss' ? 'scss' : 'css');

    ngOnInit(): void {
        this.seo.update({
            title: 'CSS ↔ SCSS Converter | Dev Tools',
            description:
                'Convert between plain CSS and SCSS in either direction, or auto-nest flat CSS into clean SCSS blocks. Free online CSS/SCSS converter.',
            url: '/tools/css-scss',
            keywords: 'css to scss, scss to css, sass converter, css scss, css to nested scss',
        });
    }

    setMode(mode: Mode): void {
        this.mode.set(mode);
        this.output.set(null);
        this.error.set(null);
    }

    setDirection(dir: Direction): void {
        this.direction.set(dir);
        this.output.set(null);
        this.error.set(null);
    }

    convert(): void {
        const code = this.code();
        if (!code.trim()) {
            this.error.set('Paste some code to convert first.');
            return;
        }
        this.loading.set(true);
        this.error.set(null);
        this.output.set(null);

        this.api.transformCss({
            from: this.from(),
            to: this.to(),
            code,
            minify: this.minifyOutput(),
        }).subscribe({
            next: (res) => {
                this.output.set(res.output);
                this.durationMs.set(res.durationMs);
                this.loading.set(false);
                this.api.reportUsage({
                    toolId: 'css-scss',
                    action: 'convert',
                    metadata: { direction: this.direction(), minify: this.minifyOutput() },
                });
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.message ?? 'Conversion failed. Check your input and try again.');
            },
        });
    }

    nest(): void {
        const code = this.nestCode();
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
                this.api.reportUsage({ toolId: 'css-scss', action: 'nest' });
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
            this.api.reportUsage({ toolId: 'css-scss', action: 'copy' });
        }
    }

    downloadOutput(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.output();
        if (!out) return;
        if (this.mode() === 'nest') {
            downloadText(out, 'nested.scss', 'text/x-scss');
        } else {
            const ext = this.to();
            downloadText(out, `converted.${ext}`, 'text/css');
        }
        this.api.reportUsage({ toolId: 'css-scss', action: 'download' });
    }
}
