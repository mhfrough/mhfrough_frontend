import { Component, OnInit, OnDestroy, HostListener, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, ImageResult, ImageEncodeOptions, ResizeFit } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { downloadDataUrl, downloadBlob } from '../shared/clipboard.util';
import { ZipEntry, buildZip } from '../shared/zip.util';

type TargetFormat = 'original' | 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'tiff';
type JobStatus = 'idle' | 'loading' | 'done' | 'error';

interface ImageJob {
    id: string;
    file: File;
    name: string;
    previewUrl: string;
    bytesIn: number;
    status: JobStatus;
    result: ImageResult | null;
    error: string | null;
}

interface HistoryEntry {
    time: string;
    label: string;
}

const LOSSY_TARGETS: TargetFormat[] = ['jpeg', 'webp', 'avif'];

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

    readonly formats: TargetFormat[] = ['original', 'jpeg', 'png', 'webp', 'avif', 'gif', 'tiff'];
    readonly fits: ResizeFit[] = ['inside', 'cover', 'contain', 'fill', 'outside'];
    readonly lossy = new Set<TargetFormat>(LOSSY_TARGETS);

    readonly items = signal<ImageJob[]>([]);
    readonly selectedId = signal<string | null>(null);
    readonly dragOver = signal(false);

    readonly format = signal<TargetFormat>('webp');
    readonly quality = signal(80);
    readonly maxWidth = signal<number | null>(null);
    readonly maxHeight = signal<number | null>(null);
    readonly fit = signal<ResizeFit>('inside');
    readonly background = signal('#ffffff');

    readonly advancedOpen = signal(false);
    readonly progressive = signal(false);
    readonly chromaSubsampling = signal<'4:4:4' | '4:2:0'>('4:2:0');
    readonly lossless = signal(false);
    readonly effort = signal(4);
    readonly pngPalette = signal(false);
    readonly keepMetadata = signal(false);
    readonly grayscale = signal(false);
    readonly rotate = signal<'auto' | '0' | '90' | '180' | '270'>('auto');
    readonly useTargetSize = signal(false);
    readonly targetSizeKB = signal(200);

    readonly compareSplit = signal(50);
    readonly processingAll = signal(false);
    readonly exporting = signal(false);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly exportHistory = signal<HistoryEntry[]>([]);

    readonly selectedItem = computed(() => this.items().find((i) => i.id === this.selectedId()) ?? null);
    readonly isBatch = computed(() => this.items().length > 1);
    readonly isOriginal = computed(() => this.format() === 'original');
    readonly isLossy = computed(() => this.lossy.has(this.format()));
    /** Quality applies whenever we're compressing in place or converting to a lossy format. */
    readonly showQuality = computed(() => this.isOriginal() || this.isLossy());
    readonly showFitBackground = computed(() => this.fit() === 'contain' || this.fit() === 'fill');

    readonly doneItems = computed(() => this.items().filter((i) => i.status === 'done'));
    readonly totalBytesIn = computed(() => this.doneItems().reduce((sum, i) => sum + i.bytesIn, 0));
    readonly totalBytesOut = computed(() => this.doneItems().reduce((sum, i) => sum + (i.result?.bytesOut ?? 0), 0));
    readonly totalSavedPct = computed(() => {
        const inBytes = this.totalBytesIn();
        if (!inBytes) return 0;
        return Math.round(((inBytes - this.totalBytesOut()) / inBytes) * 10000) / 100;
    });

    ngOnInit(): void {
        this.seo.update({
            title: 'Image Compressor & Format Converter | Dev Tools',
            description:
                'Batch compress, resize and convert images between JPEG, PNG, WebP, AVIF, GIF and TIFF with advanced controls: progressive JPEG, lossless WebP/AVIF, PNG palettes, target file size, grayscale and metadata stripping.',
            url: '/tools/image-format',
            keywords: 'image compressor, image converter, compress image, convert image format, jpg to png, png to webp, avif converter, tiff converter, batch image compress',
        });
    }

    ngOnDestroy(): void {
        this.revokeAllPreviews();
    }

    private revokeAllPreviews(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        for (const item of this.items()) URL.revokeObjectURL(item.previewUrl);
    }

    // --- Upload -----------------------------------------------------------------

    onFileInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.addFiles(Array.from(input.files ?? []));
        input.value = '';
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(false);
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
        this.addFiles(files);
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(true);
    }

    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(false);
    }

    @HostListener('window:paste', ['$event'])
    onPaste(event: ClipboardEvent): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const files = Array.from(event.clipboardData?.items ?? [])
            .filter((i) => i.kind === 'file')
            .map((i) => i.getAsFile())
            .filter((f): f is File => !!f);
        if (files.length) {
            event.preventDefault();
            this.addFiles(files);
        }
    }

    private addFiles(files: File[]): void {
        if (!isPlatformBrowser(this.platformId) || !files.length) return;
        this.error.set(null);
        const jobs: ImageJob[] = files.map((file) => ({
            id: crypto.randomUUID(),
            file,
            name: file.name,
            previewUrl: URL.createObjectURL(file),
            bytesIn: file.size,
            status: 'idle',
            result: null,
            error: null,
        }));
        this.items.update((list) => [...list, ...jobs]);
        if (!this.selectedId() && jobs.length) this.selectedId.set(jobs[0].id);
    }

    selectItem(id: string): void {
        this.selectedId.set(id);
        this.compareSplit.set(50);
    }

    removeItem(id: string): void {
        const item = this.items().find((i) => i.id === id);
        if (item && isPlatformBrowser(this.platformId)) URL.revokeObjectURL(item.previewUrl);
        const remaining = this.items().filter((i) => i.id !== id);
        this.items.set(remaining);
        if (this.selectedId() === id) this.selectedId.set(remaining[0]?.id ?? null);
    }

    clearAll(): void {
        this.revokeAllPreviews();
        this.items.set([]);
        this.selectedId.set(null);
    }

    private updateItem(id: string, patch: Partial<ImageJob>): void {
        this.items.update((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    }

    // --- Options ------------------------------------------------------------------

    setMaxWidth(value: string): void {
        const n = value === '' ? null : Math.round(Number(value));
        this.maxWidth.set(n != null && isFinite(n) && n > 0 ? n : null);
    }

    setMaxHeight(value: string): void {
        const n = value === '' ? null : Math.round(Number(value));
        this.maxHeight.set(n != null && isFinite(n) && n > 0 ? n : null);
    }

    toggleAdvanced(): void {
        this.advancedOpen.update((v) => !v);
    }

    private buildOptions(): ImageEncodeOptions {
        return {
            quality: this.quality(),
            maxWidth: this.maxWidth() ?? undefined,
            maxHeight: this.maxHeight() ?? undefined,
            fit: this.fit(),
            background: this.showFitBackground() ? this.background() : undefined,
            progressive: this.progressive(),
            chromaSubsampling: this.chromaSubsampling(),
            lossless: this.lossless(),
            effort: this.effort(),
            pngPalette: this.pngPalette(),
            stripMetadata: !this.keepMetadata(),
            grayscale: this.grayscale(),
            rotate: this.rotate() === 'auto' ? undefined : Number(this.rotate()),
            targetSizeKB: this.useTargetSize() ? this.targetSizeKB() : undefined,
        };
    }

    // --- Run ------------------------------------------------------------------

    async runAll(): Promise<void> {
        if (!isPlatformBrowser(this.platformId) || this.processingAll() || !this.items().length) return;
        this.processingAll.set(true);
        this.loading.set(true);
        this.error.set(null);

        const opts = this.buildOptions();
        const fmt = this.format();
        let failures = 0;

        for (const item of this.items()) {
            this.updateItem(item.id, { status: 'loading', error: null });
            try {
                const res = this.isOriginal()
                    ? await firstValueFrom(this.api.compressImage(item.file, opts))
                    : await firstValueFrom(this.api.convertImage(item.file, fmt, opts));
                this.updateItem(item.id, { status: 'done', result: res });
            } catch (err: any) {
                failures++;
                this.updateItem(item.id, { status: 'error', error: err?.error?.message ?? 'Processing failed.' });
            }
        }

        this.processingAll.set(false);
        this.loading.set(false);
        if (failures === this.items().length && failures > 0) {
            this.error.set('All images failed to process. Try different files or settings.');
        }

        this.api.reportUsage({
            toolId: 'image-format',
            action: this.isOriginal() ? 'compress-batch' : `convert-batch-${fmt}`,
            metadata: { count: this.items().length, format: fmt, quality: opts.quality },
        });
        this.pushHistory(
            `${this.items().length} image${this.items().length === 1 ? '' : 's'} → ${this.isOriginal() ? 'compressed' : fmt.toUpperCase()}`,
        );
    }

    // --- Download -----------------------------------------------------------------

    download(item: ImageJob | null = this.selectedItem()): void {
        if (!isPlatformBrowser(this.platformId) || !item?.result) return;
        downloadDataUrl(item.result.output, this.downloadName(item));
        this.api.reportUsage({ toolId: 'image-format', action: 'download' });
    }

    async downloadZip(): Promise<void> {
        if (!isPlatformBrowser(this.platformId) || !this.doneItems().length) return;
        this.exporting.set(true);
        try {
            const entries: ZipEntry[] = [];
            for (const item of this.doneItems()) {
                if (!item.result) continue;
                const res = await fetch(item.result.output);
                const blob = await res.blob();
                entries.push({ path: this.downloadName(item), data: blob });
            }
            const zip = await buildZip(entries);
            downloadBlob(zip, 'compressed-images.zip');
            this.pushHistory(`Downloaded ${entries.length} file(s) as ZIP`);
            this.api.reportUsage({ toolId: 'image-format', action: 'download-zip', metadata: { count: entries.length } });
        } finally {
            this.exporting.set(false);
        }
    }

    private downloadName(item: ImageJob): string {
        const original = item.name;
        const dot = original.lastIndexOf('.');
        const base = dot > 0 ? original.slice(0, dot) : original;
        if (this.isOriginal()) {
            const ext = dot > 0 ? original.slice(dot) : '';
            return `${base}-compressed${ext}`;
        }
        const ext = this.format() === 'jpeg' ? 'jpg' : this.format();
        return `${base}.${ext}`;
    }

    private pushHistory(label: string): void {
        this.exportHistory.update((list) => [{ time: new Date().toLocaleTimeString(), label }, ...list].slice(0, 8));
    }

    formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
}
