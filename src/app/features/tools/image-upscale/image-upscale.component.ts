import { Component, OnInit, OnDestroy, HostListener, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, ImageResult, UpscaleKernel } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { downloadDataUrl, downloadBlob } from '../shared/clipboard.util';
import { ZipEntry, buildZip } from '../shared/zip.util';

type JobStatus = 'idle' | 'loading' | 'done' | 'error';

interface UpscaleJob {
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

interface KernelOption {
    value: UpscaleKernel;
    label: string;
}

const KERNELS: KernelOption[] = [
    { value: 'nearest', label: 'Nearest neighbor (fastest, blocky)' },
    { value: 'cubic', label: 'Bicubic (smooth)' },
    { value: 'mitchell', label: 'Mitchell (balanced)' },
    { value: 'lanczos2', label: 'Lanczos2' },
    { value: 'lanczos3', label: 'Lanczos3 (sharpest, default)' },
];

@Component({
    selector: 'app-image-upscale',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './image-upscale.component.html',
    styleUrl: './image-upscale.component.scss',
})
export class ImageUpscaleComponent implements OnInit, OnDestroy {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly scales = [2, 3, 4];
    readonly kernels = KERNELS;

    readonly items = signal<UpscaleJob[]>([]);
    readonly selectedId = signal<string | null>(null);
    readonly dragOver = signal(false);

    readonly scale = signal(2);
    readonly customScaleEnabled = signal(false);
    readonly customScale = signal(2.5);
    readonly kernel = signal<UpscaleKernel>('lanczos3');
    readonly sharpen = signal(false);
    readonly useTargetWidth = signal(false);
    readonly targetWidth = signal<number | null>(null);

    readonly compareSplit = signal(50);
    readonly processingAll = signal(false);
    readonly exporting = signal(false);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly exportHistory = signal<HistoryEntry[]>([]);

    readonly effectiveScale = computed(() => (this.customScaleEnabled() ? this.customScale() : this.scale()));
    readonly selectedItem = computed(() => this.items().find((i) => i.id === this.selectedId()) ?? null);
    readonly isBatch = computed(() => this.items().length > 1);
    readonly doneItems = computed(() => this.items().filter((i) => i.status === 'done'));

    ngOnInit(): void {
        this.seo.update({
            title: 'Image Upscaler | Dev Tools',
            description:
                'Enlarge images up to 8x with a choice of resampling kernels (Lanczos, Mitchell, Bicubic, Nearest), optional sharpening, an exact target width, and batch processing with ZIP export.',
            url: '/tools/image-upscale',
            keywords: 'image upscaler, enlarge image, upscale image, resize image, lanczos resampling, batch image upscale',
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
        const jobs: UpscaleJob[] = files.map((file) => ({
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

    private updateItem(id: string, patch: Partial<UpscaleJob>): void {
        this.items.update((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    }

    selectPresetScale(s: number): void {
        this.scale.set(s);
        this.customScaleEnabled.set(false);
        this.useTargetWidth.set(false);
    }

    setCustomScaleEnabled(enabled: boolean): void {
        this.customScaleEnabled.set(enabled);
        if (enabled) this.useTargetWidth.set(false);
    }

    setUseTargetWidth(enabled: boolean): void {
        this.useTargetWidth.set(enabled);
        if (enabled) this.customScaleEnabled.set(false);
    }

    setTargetWidth(value: string): void {
        const n = value === '' ? null : Math.round(Number(value));
        this.targetWidth.set(n != null && isFinite(n) && n > 0 ? n : null);
    }

    // --- Run ------------------------------------------------------------------

    async runAll(): Promise<void> {
        if (!isPlatformBrowser(this.platformId) || this.processingAll() || !this.items().length) return;
        this.processingAll.set(true);
        this.loading.set(true);
        this.error.set(null);

        const scale = this.effectiveScale();
        const targetWidth = this.useTargetWidth() ? this.targetWidth() ?? undefined : undefined;
        const kernel = this.kernel();
        const sharpen = this.sharpen();
        let failures = 0;

        for (const item of this.items()) {
            this.updateItem(item.id, { status: 'loading', error: null });
            try {
                const res = await firstValueFrom(this.api.upscaleImage(item.file, scale, { kernel, sharpen, targetWidth }));
                this.updateItem(item.id, { status: 'done', result: res });
            } catch (err: any) {
                failures++;
                this.updateItem(item.id, { status: 'error', error: err?.error?.message ?? 'Upscale failed.' });
            }
        }

        this.processingAll.set(false);
        this.loading.set(false);
        if (failures === this.items().length && failures > 0) {
            this.error.set('All images failed to upscale. Try a different image or settings.');
        }

        this.api.reportUsage({
            toolId: 'image-upscale',
            action: 'run-batch',
            metadata: { count: this.items().length, scale, kernel, sharpen, targetWidth },
        });
        this.pushHistory(
            `${this.items().length} image${this.items().length === 1 ? '' : 's'} → ${targetWidth ? `${targetWidth}px wide` : `${scale}×`}`,
        );
    }

    // --- Download -----------------------------------------------------------------

    download(item: UpscaleJob | null = this.selectedItem()): void {
        if (!isPlatformBrowser(this.platformId) || !item?.result) return;
        downloadDataUrl(item.result.output, this.downloadName(item));
        this.api.reportUsage({ toolId: 'image-upscale', action: 'download' });
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
            downloadBlob(zip, 'upscaled-images.zip');
            this.pushHistory(`Downloaded ${entries.length} file(s) as ZIP`);
            this.api.reportUsage({ toolId: 'image-upscale', action: 'download-zip', metadata: { count: entries.length } });
        } finally {
            this.exporting.set(false);
        }
    }

    private downloadName(item: UpscaleJob): string {
        const dot = item.name.lastIndexOf('.');
        const base = dot > 0 ? item.name.slice(0, dot) : item.name;
        const ext = dot > 0 ? item.name.slice(dot) : '';
        const label = this.useTargetWidth() && this.targetWidth() ? `${this.targetWidth()}w` : `${this.effectiveScale()}x`;
        return `${base}-${label}${ext}`;
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
