import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

@Component({
    selector: 'app-rem-px',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './rem-px.component.html',
    styleUrl: './rem-px.component.scss',
})
export class RemPxComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly rootSize = signal(16);
    readonly remValue = signal(1);
    readonly pxValue = signal(16);

    readonly copied = signal<'rem' | 'px' | null>(null);

    private safeRoot = computed(() => {
        const r = Number(this.rootSize());
        return r > 0 ? r : 16;
    });

    // rem → px
    readonly remToPx = computed(() => {
        const v = Number(this.remValue());
        if (!isFinite(v)) return '';
        return this.fmt(v * this.safeRoot());
    });

    // px → rem
    readonly pxToRem = computed(() => {
        const v = Number(this.pxValue());
        if (!isFinite(v)) return '';
        return this.fmt(v / this.safeRoot());
    });

    ngOnInit(): void {
        this.seo.update({
            title: 'REM ↔ PX Converter | Dev Tools',
            description:
                'Convert between rem and px instantly against any root font-size. Free, runs entirely in your browser.',
            url: '/tools/rem-px',
            keywords: 'rem to px, px to rem, css unit converter, root font size',
        });
    }

    private fmt(n: number): string {
        if (!isFinite(n)) return '';
        return parseFloat(n.toFixed(4)).toString();
    }

    convert(): void {
        // Computeds already update live; this just records the explicit action.
        this.api.reportUsage({ toolId: 'rem-px', action: 'convert' });
    }

    async copy(which: 'rem' | 'px'): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const value = which === 'px' ? this.remToPx() : this.pxToRem();
        const ok = await copyText(which === 'px' ? `${value}px` : `${value}rem`);
        if (ok) {
            this.copied.set(which);
            setTimeout(() => this.copied.set(null), 1400);
            this.api.reportUsage({ toolId: 'rem-px', action: 'copy', metadata: { which } });
        }
    }
}
