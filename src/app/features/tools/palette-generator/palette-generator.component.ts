import { Component, OnInit, OnDestroy, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, PaletteColor, PaletteScheme } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

interface SchemeOption {
    value: PaletteScheme;
    label: string;
}

type PaletteMode = 'seed' | 'image';

@Component({
    selector: 'app-palette-generator',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './palette-generator.component.html',
    styleUrl: './palette-generator.component.scss',
})
export class PaletteGeneratorComponent implements OnInit, OnDestroy {
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

    readonly mode = signal<PaletteMode>('seed');

    // --- From Seed -----------------------------------------------------------
    readonly base = signal('#6366f1');
    readonly scheme = signal<PaletteScheme>('analogous');
    readonly count = signal(5);

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly colors = signal<string[] | null>(null);
    readonly copiedHex = signal<string | null>(null);

    // --- From Image ------------------------------------------------------------
    readonly file = signal<File | null>(null);
    readonly previewUrl = signal<string | null>(null);
    readonly imageCount = signal(6);
    readonly dragOver = signal(false);

    readonly imageLoading = signal(false);
    readonly imageError = signal<string | null>(null);
    readonly imageColors = signal<PaletteColor[] | null>(null);
    readonly imageCopiedHex = signal<string | null>(null);

    readonly maxPopulation = computed(() => {
        const cols = this.imageColors();
        if (!cols || cols.length === 0) return 1;
        return Math.max(...cols.map((c) => c.population), 1);
    });

    ngOnInit(): void {
        this.seo.update({
            title: 'Color Palette Studio | Dev Tools',
            description:
                'Generate a harmonious color palette from a seed colour — analogous, complementary, triadic, tetradic, monochromatic, shades and tints — or extract one from any image.',
            url: '/tools/palette-generator',
            keywords: 'color palette generator, color scheme, extract palette, dominant colors, hex colors',
        });
    }

    ngOnDestroy(): void {
        this.revokePreview();
    }

    setMode(mode: PaletteMode): void {
        this.mode.set(mode);
    }

    // --- From Seed -------------------------------------------------------------
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
                    action: 'from-seed',
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

    // --- From Image --------------------------------------------------------
    private revokePreview(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const prev = this.previewUrl();
        if (prev) URL.revokeObjectURL(prev);
    }

    onFileInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.setFile(input.files?.[0] ?? null);
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(false);
        const file = event.dataTransfer?.files?.[0] ?? null;
        if (file && file.type.startsWith('image/')) this.setFile(file);
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(true);
    }

    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(false);
    }

    private setFile(file: File | null): void {
        this.revokePreview();
        this.file.set(file);
        this.imageColors.set(null);
        this.imageError.set(null);
        if (file && isPlatformBrowser(this.platformId)) {
            this.previewUrl.set(URL.createObjectURL(file));
        } else {
            this.previewUrl.set(null);
        }
    }

    runImage(): void {
        const file = this.file();
        if (!file) {
            this.imageError.set('Choose an image first.');
            return;
        }
        const count = Math.min(12, Math.max(3, Math.round(this.imageCount())));
        this.imageCount.set(count);
        this.imageLoading.set(true);
        this.imageError.set(null);
        this.imageColors.set(null);

        this.api.imagePalette(file, count).subscribe({
            next: (res) => {
                this.imageColors.set(res.colors);
                this.imageLoading.set(false);
                this.api.reportUsage({
                    toolId: 'palette-generator',
                    action: 'from-image',
                    metadata: { count },
                });
            },
            error: (err) => {
                this.imageLoading.set(false);
                this.imageError.set(err?.error?.message ?? 'Palette extraction failed. Try a different image.');
            },
        });
    }

    async copyImageHex(hex: string): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        if (await copyText(hex)) {
            this.imageCopiedHex.set(hex);
            setTimeout(() => {
                if (this.imageCopiedHex() === hex) this.imageCopiedHex.set(null);
            }, 1400);
            this.api.reportUsage({ toolId: 'palette-generator', action: 'copy' });
        }
    }

    populationPct(color: PaletteColor): number {
        return Math.round((color.population / this.maxPopulation()) * 100);
    }

    /** Choose readable text color over a swatch using relative luminance. */
    textOn(color: PaletteColor): string {
        const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
        return luminance > 0.55 ? 'var(--bg)' : 'var(--text)';
    }
}
