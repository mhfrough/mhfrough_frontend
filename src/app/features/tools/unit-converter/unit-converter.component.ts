import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

type Unit = 'px' | 'rem' | 'em' | 'pt' | '%' | 'vw' | 'vh' | 'ch' | 'vmin' | 'vmax';

interface UnitRow {
    unit: Unit;
    value: string;
}

@Component({
    selector: 'app-unit-converter',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './unit-converter.component.html',
    styleUrl: './unit-converter.component.scss',
})
export class UnitConverterComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly units: Unit[] = ['px', 'rem', 'em', 'pt', '%', 'vw', 'vh', 'ch', 'vmin', 'vmax'];

    // Inputs
    readonly amount = signal(16);
    readonly fromUnit = signal<Unit>('px');

    // Context
    readonly baseFontSize = signal(16); // px — used for rem/em/%/ch (assumes parent == root)
    readonly viewportW = signal(1920);
    readonly viewportH = signal(1080);

    /** Convert the input amount to an absolute pixel value. */
    private toPx(value: number, unit: Unit): number {
        const base = this.safe(this.baseFontSize(), 16);
        const vw = this.safe(this.viewportW(), 1920);
        const vh = this.safe(this.viewportH(), 1080);
        switch (unit) {
            case 'px': return value;
            case 'rem':
            case 'em': return value * base;
            case '%': return (value / 100) * base;
            case 'pt': return value * (96 / 72); // 1pt = 1/72in, 1in = 96px
            case 'vw': return (value / 100) * vw;
            case 'vh': return (value / 100) * vh;
            case 'ch': return value * (base * 0.5); // approximate: '0' glyph ≈ 0.5× font-size
            case 'vmin': return (value / 100) * Math.min(vw, vh);
            case 'vmax': return (value / 100) * Math.max(vw, vh);
        }
    }

    /** Convert an absolute pixel value into the requested unit. */
    private fromPx(px: number, unit: Unit): number {
        const base = this.safe(this.baseFontSize(), 16);
        const vw = this.safe(this.viewportW(), 1920);
        const vh = this.safe(this.viewportH(), 1080);
        switch (unit) {
            case 'px': return px;
            case 'rem':
            case 'em': return px / base;
            case '%': return (px / base) * 100;
            case 'pt': return px * (72 / 96);
            case 'vw': return (px / vw) * 100;
            case 'vh': return (px / vh) * 100;
            case 'ch': return px / (base * 0.5);
            case 'vmin': return (px / Math.min(vw, vh)) * 100;
            case 'vmax': return (px / Math.max(vw, vh)) * 100;
        }
    }

    readonly results = computed<UnitRow[]>(() => {
        const amt = Number(this.amount());
        if (!isFinite(amt)) return this.units.map(u => ({ unit: u, value: '' }));
        const px = this.toPx(amt, this.fromUnit());
        return this.units.map(u => ({ unit: u, value: this.fmt(this.fromPx(px, u)) }));
    });

    // --- Quick rem <-> px panel (absorbed from rem-px tool) --------------------
    readonly quickRootSize = signal(16);
    readonly quickRemValue = signal(1);
    readonly quickPxValue = signal(16);

    readonly quickCopied = signal<'rem' | 'px' | null>(null);

    private quickSafeRoot = computed(() => {
        const r = Number(this.quickRootSize());
        return r > 0 ? r : 16;
    });

    // rem → px
    readonly quickRemToPx = computed(() => {
        const v = Number(this.quickRemValue());
        if (!isFinite(v)) return '';
        return this.fmt(v * this.quickSafeRoot());
    });

    // px → rem
    readonly quickPxToRem = computed(() => {
        const v = Number(this.quickPxValue());
        if (!isFinite(v)) return '';
        return this.fmt(v / this.quickSafeRoot());
    });

    quickConvert(): void {
        // Computeds already update live; this just records the explicit action.
        this.api.reportUsage({ toolId: 'unit-converter', action: 'quick-convert' });
    }

    async quickCopy(which: 'rem' | 'px'): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const value = which === 'px' ? this.quickRemToPx() : this.quickPxToRem();
        const ok = await copyText(which === 'px' ? `${value}px` : `${value}rem`);
        if (ok) {
            this.quickCopied.set(which);
            setTimeout(() => this.quickCopied.set(null), 1400);
            this.api.reportUsage({ toolId: 'unit-converter', action: 'copy', metadata: { which } });
        }
    }

    ngOnInit(): void {
        this.seo.update({
            title: 'CSS Unit Converter | Dev Tools',
            description:
                'Convert between px, rem, em, pt, %, vw, vh, ch, vmin and vmax with a configurable base font-size and viewport, plus a live rem ↔ px quick panel. Free, client-side CSS unit converter.',
            url: '/tools/css-units',
            keywords: 'css unit converter, px rem em pt vw vh ch vmin vmax, viewport units, css units, rem to px, px to rem',
        });
    }

    private safe(v: number, fallback: number): number {
        const n = Number(v);
        return n > 0 ? n : fallback;
    }

    private fmt(n: number): string {
        if (!isFinite(n)) return '';
        return parseFloat(n.toFixed(4)).toString();
    }

    convert(): void {
        this.api.reportUsage({ toolId: 'unit-converter', action: 'convert', metadata: { from: this.fromUnit() } });
    }
}
