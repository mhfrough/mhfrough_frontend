import { Component, OnInit, OnDestroy, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, ImageResult } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { downloadDataUrl } from '../shared/clipboard.util';

type TargetFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif';

@Component({
    selector: 'app-image-format',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './image-format.component.html',
    styleUrl: './image-format.component.scss',
})
export class ImageFormatComponent implements OnInit, OnDestroy {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly formats: TargetFormat[] = ['jpeg', 'png', 'webp', 'avif', 'gif'];
    readonly lossy = new Set<TargetFormat>(['jpeg', 'webp', 'avif']);

    readonly file = signal<File | null>(null);
    readonly previewUrl = signal<string | null>(null);
    readonly format = signal<TargetFormat>('webp');
    readonly quality = signal(80);
    readonly dragOver = signal(false);

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly result = signal<ImageResult | null>(null);

    readonly isLossy = computed(() => this.lossy.has(this.format()));

    ngOnInit(): void {
        this.seo.update({
            title: 'Image Format Converter | Dev Tools',
            description:
                'Convert images between JPEG, PNG, WebP, AVIF and GIF. Adjust quality for lossy formats. Free online image format converter.',
            url: '/tools/image-format',
            keywords: 'image converter, convert image format, jpg to png, png to webp, avif converter',
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
        this.result.set(null);
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
        this.loading.set(true);
        this.error.set(null);
        this.result.set(null);

        const quality = this.isLossy() ? this.quality() : undefined;
        this.api.convertImage(file, this.format(), quality).subscribe({
            next: (res) => {
                this.result.set(res);
                this.loading.set(false);
                this.api.reportUsage({
                    toolId: 'image-format',
                    action: 'run',
                    metadata: { format: this.format(), quality },
                });
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.message ?? 'Conversion failed. Try a different image.');
            },
        });
    }

    download(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const res = this.result();
        const file = this.file();
        if (!res || !file) return;
        downloadDataUrl(res.output, this.downloadName(file.name));
        this.api.reportUsage({ toolId: 'image-format', action: 'download' });
    }

    private downloadName(original: string): string {
        const dot = original.lastIndexOf('.');
        const base = dot > 0 ? original.slice(0, dot) : original;
        const ext = this.format() === 'jpeg' ? 'jpg' : this.format();
        return `${base}.${ext}`;
    }

    formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
}
