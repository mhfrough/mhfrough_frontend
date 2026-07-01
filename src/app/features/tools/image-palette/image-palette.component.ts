import { Component, OnInit, OnDestroy, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, PaletteColor } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

@Component({
    selector: 'app-image-palette',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './image-palette.component.html',
    styleUrl: './image-palette.component.scss',
})
export class ImagePaletteComponent implements OnInit, OnDestroy {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly file = signal<File | null>(null);
    readonly previewUrl = signal<string | null>(null);
    readonly count = signal(6);
    readonly dragOver = signal(false);

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly colors = signal<PaletteColor[] | null>(null);
    readonly copiedHex = signal<string | null>(null);

    readonly maxPopulation = computed(() => {
        const cols = this.colors();
        if (!cols || cols.length === 0) return 1;
        return Math.max(...cols.map((c) => c.population), 1);
    });

    ngOnInit(): void {
        this.seo.update({
            title: 'Image Color Palette Extractor | Dev Tools',
            description:
                'Extract a color palette from any image. Pull 3–12 dominant colors with hex values you can copy in one click. Free online palette extractor.',
            url: '/tools/image-palette',
            keywords: 'color palette extractor, image colors, dominant colors, extract palette, color picker',
        });
    }

    ngOnDestroy(): void {
        this.revokePreview();
    }

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
        this.colors.set(null);
        this.error.set(null);
        if (file && isPlatformBrowser(this.platformId)) {
            this.previewUrl.set(URL.createObjectURL(file));
        } else {
            this.previewUrl.set(null);
        }
    }

    run(): void {
        const file = this.file();
        if (!file) {
            this.error.set('Choose an image first.');
            return;
        }
        const count = Math.min(12, Math.max(3, Math.round(this.count())));
        this.count.set(count);
        this.loading.set(true);
        this.error.set(null);
        this.colors.set(null);

        this.api.imagePalette(file, count).subscribe({
            next: (res) => {
                this.colors.set(res.colors);
                this.loading.set(false);
                this.api.reportUsage({
                    toolId: 'image-palette',
                    action: 'run',
                    metadata: { count },
                });
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.message ?? 'Palette extraction failed. Try a different image.');
            },
        });
    }

    async copyHex(hex: string): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        if (await copyText(hex)) {
            this.copiedHex.set(hex);
            setTimeout(() => {
                if (this.copiedHex() === hex) this.copiedHex.set(null);
            }, 1400);
            this.api.reportUsage({ toolId: 'image-palette', action: 'copy' });
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
