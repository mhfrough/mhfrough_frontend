import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';

type Unit = 'px' | 'rem' | 'em' | 'pt' | '%' | 'vw' | 'vh';

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

    readonly units: Unit[] = ['px', 'rem', 'em', 'pt', '%', 'vw', 'vh'];

    // Inputs
    readonly amount = signal(16);
    readonly fromUnit = signal<Unit>('px');

    // Context
    readonly baseFontSize = signal(16); // px — used for rem/em/% (assumes parent == root)
    readonly viewportW = signal(1920);
    readonly viewportH = signal(1080);

    /** Convert the input amount to an absolute pixel value. */
    private toPx(value: number, unit: Unit): number {
        const base = this.safe(this.baseFontSize(), 16);
        switch (unit) {
            case 'px': return value;
            case 'rem':
            case 'em': return value * base;
            case '%': return (value / 100) * base;
            case 'pt': return value * (96 / 72); // 1pt = 1/72in, 1in = 96px
            case 'vw': return (value / 100) * this.safe(this.viewportW(), 1920);
            case 'vh': return (value / 100) * this.safe(this.viewportH(), 1080);
        }
    }

    /** Convert an absolute pixel value into the requested unit. */
    private fromPx(px: number, unit: Unit): number {
        const base = this.safe(this.baseFontSize(), 16);
        switch (unit) {
            case 'px': return px;
            case 'rem':
            case 'em': return px / base;
            case '%': return (px / base) * 100;
            case 'pt': return px * (72 / 96);
            case 'vw': return (px / this.safe(this.viewportW(), 1920)) * 100;
            case 'vh': return (px / this.safe(this.viewportH(), 1080)) * 100;
        }
    }

    readonly results = computed<UnitRow[]>(() => {
        const amt = Number(this.amount());
        if (!isFinite(amt)) return this.units.map(u => ({ unit: u, value: '' }));
        const px = this.toPx(amt, this.fromUnit());
        return this.units.map(u => ({ unit: u, value: this.fmt(this.fromPx(px, u)) }));
    });

    ngOnInit(): void {
        this.seo.update({
            title: 'CSS Unit Converter | Dev Tools',
            description:
                'Convert between px, rem, em, pt, %, vw and vh with a configurable base font-size and viewport. Free, client-side CSS unit converter.',
            url: '/tools/css-units',
            keywords: 'css unit converter, px rem em pt vw vh, viewport units, css units',
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
