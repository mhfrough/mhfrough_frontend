import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, PaletteScheme } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

interface SchemeOption {
    value: PaletteScheme;
    label: string;
}

@Component({
    selector: 'app-palette-generator',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './palette-generator.component.html',
    styleUrl: './palette-generator.component.scss',
})
export class PaletteGeneratorComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly schemes: SchemeOption[] = [
        { value: 'analogous', label: 'Analogous' },
        { value: 'complementary', label: 'Complementary' },
        { value: 'triadic', label: 'Triadic' },
        { value: 'tetradic', label: 'Tetradic' },
        { value: 'monochromatic', label: 'Monochromatic' },
        { value: 'shades', label: 'Shades' },
        { value: 'tints', label: 'Tints' },
    ];

    readonly base = signal('#6366f1');
    readonly scheme = signal<PaletteScheme>('analogous');
    readonly count = signal(5);

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly colors = signal<string[] | null>(null);
    readonly copiedHex = signal<string | null>(null);

    ngOnInit(): void {
        this.seo.update({
            title: 'Color Palette Generator | Dev Tools',
            description:
                'Generate harmonious color palettes from any base color — analogous, complementary, triadic, tetradic, monochromatic, shades and tints. Click any swatch to copy its hex.',
            url: '/tools/palette-generator',
            keywords: 'color palette generator, color scheme, analogous, complementary, triadic, hex colors',
        });
    }

    /** Keep the colour picker and the hex text input in sync (picker -> text). */
    setBaseFromPicker(value: string): void {
        this.base.set(value);
    }

    /** Keep the hex text input and the colour picker in sync (text -> picker). */
    setBaseFromText(value: string): void {
        this.base.set(value);
    }

    /** Normalised hex for the <input type="color">, which only accepts #rrggbb. */
    get pickerValue(): string {
        const v = this.base().trim();
        return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#6366f1';
    }

    setCount(value: number): void {
        const n = Math.round(Number(value));
        if (!isFinite(n)) return;
        this.count.set(Math.min(10, Math.max(3, n)));
    }

    generate(): void {
        const base = this.base().trim();
        if (!/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(base)) {
            this.error.set('Enter a valid hex colour (e.g. #6366f1).');
            return;
        }
        this.loading.set(true);
        this.error.set(null);
        this.colors.set(null);

        this.api.palette({
            base: base.startsWith('#') ? base : `#${base}`,
            scheme: this.scheme(),
            count: this.count(),
        }).subscribe({
            next: (res) => {
                this.colors.set(res.colors);
                this.loading.set(false);
                this.api.reportUsage({
                    toolId: 'palette-generator',
                    action: 'generate',
                    metadata: { scheme: this.scheme(), count: this.count() },
                });
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.message ?? 'Could not generate a palette. Try a different colour.');
            },
        });
    }

    async copyHex(hex: string): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        if (await copyText(hex)) {
            this.copiedHex.set(hex);
            setTimeout(() => this.copiedHex.set(null), 1400);
            this.api.reportUsage({ toolId: 'palette-generator', action: 'copy' });
        }
    }
}
