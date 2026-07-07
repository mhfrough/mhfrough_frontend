import { Component, HostListener, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadBlob } from '../shared/clipboard.util';
import {
    BackgroundKind,
    CompositeOptions,
    CornerShape,
    CropRect,
    ImageWarnings,
    analyzeImage,
    autoCropTransparent,
    canvasToPngBlob,
    canvasToPngDataUrl,
    compositeIcon,
    cropToRect,
    dataUrlToBlob,
    decodeToCanvas,
    resizeSquare,
} from '../shared/image-canvas.util';
import { ZipEntry, buildZip } from '../shared/zip.util';
import {
    buildBrowserConfigXml,
    buildHtmlSnippet,
    buildManifestJson,
    buildReadme,
    buildWebManifest,
} from '../shared/favicon-manifest.util';
import { FaviconMockupComponent, MockupKind } from './favicon-mockup.component';

type CropMode = 'auto' | 'original' | 'manual';
type EditorTab = 'edit' | 'preview' | 'export';

interface FaviconItem {
    id: string;
    name: string;
    sourceCanvas: HTMLCanvasElement;
    thumbUrl: string;
    warnings: ImageWarnings;
    bytesIn: number;
    isSvg: boolean;
    svgText: string | null;
}

interface HistoryEntry {
    time: string;
    label: string;
}

const EXPORT_SIZES = [16, 32, 48, 64, 96, 128, 150, 180, 192, 256, 512];
const PREVIEW_SIZES = [16, 32, 48, 64, 96, 128, 180, 192, 256, 512];
const ZOOM_LEVELS = [1, 2, 4, 8, 16];
const MOCKUPS: { kind: MockupKind; label: string }[] = [
    { kind: 'browser-tab', label: 'Browser Tab' },
    { kind: 'bookmark', label: 'Bookmark' },
    { kind: 'windows-shortcut', label: 'Windows Shortcut' },
    { kind: 'macos-dock', label: 'macOS Dock' },
    { kind: 'android-home', label: 'Android Home Screen' },
    { kind: 'iphone-home', label: 'iPhone Home Screen' },
];

@Component({
    selector: 'app-favicon-ico',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent, FaviconMockupComponent],
    templateUrl: './favicon-ico.component.html',
    styleUrl: './favicon-ico.component.scss',
})
export class FaviconIcoComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly previewSizes = PREVIEW_SIZES;
    readonly zoomLevels = ZOOM_LEVELS;
    readonly mockups = MOCKUPS;

    readonly tab = signal<EditorTab>('edit');
    readonly items = signal<FaviconItem[]>([]);
    readonly selectedId = signal<string | null>(null);
    readonly dragOver = signal(false);

    readonly cropMode = signal<CropMode>('auto');
    readonly manualRect = signal<CropRect | null>(null);
    readonly autoCenter = signal(true);
    readonly paddingPct = signal(8);
    readonly background = signal<BackgroundKind>('transparent');
    readonly customColor = signal('#ffffff');
    readonly cornerShape = signal<CornerShape>('square');
    readonly recentColors = signal<string[]>([]);

    readonly siteName = signal('My Site');
    readonly themeColor = signal('#ffffff');

    readonly darkItem = signal<{ sourceCanvas: HTMLCanvasElement; warnings: ImageWarnings } | null>(null);

    readonly zoomSize = signal(32);
    readonly zoomLevel = signal(1);
    readonly showPixelGrid = signal(false);
    readonly previewKind = signal<MockupKind>('browser-tab');
    readonly compareSplit = signal(50);

    readonly urlInput = signal('');
    readonly urlLoading = signal(false);
    readonly copiedHtml = signal(false);
    readonly exporting = signal(false);
    readonly loading = signal(false);
    readonly upscaling = signal(false);
    readonly error = signal<string | null>(null);
    readonly exportHistory = signal<HistoryEntry[]>([]);
    readonly upscaleScales = [2, 3, 4] as const;

    private cropDragging = false;
    private cropStart = { x: 0, y: 0 };

    readonly selectedItem = computed(() => this.items().find((i) => i.id === this.selectedId()) ?? null);
    readonly isBatch = computed(() => this.items().length > 1);

    readonly selectedSourceDataUrl = computed(() => this.selectedItem()?.thumbUrl ?? null);

    readonly manualRectStyle = computed(() => {
        const item = this.selectedItem();
        const rect = this.manualRect();
        if (!item || !rect) return null;
        return {
            left: `${(rect.x / item.sourceCanvas.width) * 100}%`,
            top: `${(rect.y / item.sourceCanvas.height) * 100}%`,
            width: `${(rect.width / item.sourceCanvas.width) * 100}%`,
            height: `${(rect.height / item.sourceCanvas.height) * 100}%`,
        };
    });

    readonly masterCanvas = computed<HTMLCanvasElement | null>(() => {
        const item = this.selectedItem();
        return item ? this.buildMasterFor(item) : null;
    });

    readonly masterDataUrl = computed(() => {
        const c = this.masterCanvas();
        return c ? canvasToPngDataUrl(c) : null;
    });

    readonly darkMasterCanvas = computed<HTMLCanvasElement | null>(() =>
        this.isBatch() ? null : this.buildDarkMaster(),
    );

    readonly darkMasterDataUrl = computed(() => {
        const c = this.darkMasterCanvas();
        return c ? canvasToPngDataUrl(c) : null;
    });

    readonly previewChips = computed(() => {
        const c = this.masterCanvas();
        if (!c) return [];
        return this.previewSizes.map((size) => ({ size, url: canvasToPngDataUrl(resizeSquare(c, size)) }));
    });

    readonly zoomDataUrl = computed(() => {
        const c = this.masterCanvas();
        if (!c) return null;
        return canvasToPngDataUrl(resizeSquare(c, this.zoomSize()));
    });

    readonly htmlSnippet = computed(() =>
        buildHtmlSnippet({ themeColor: this.themeColor(), hasDarkVariant: !!this.darkMasterDataUrl() }),
    );

    readonly warningMessages = computed(() => {
        const item = this.selectedItem();
        if (!item) return [];
        const w = item.warnings;
        const msgs: string[] = [];
        if (w.tooSmall) msgs.push('This image is quite small — a higher-resolution source will look crisper at 256 to 512px.');
        if (w.nonSquare) msgs.push('This image is not square, so it will be letterboxed into a square icon.');
        if (w.lowRes) msgs.push('Resolution is on the low side for the larger export sizes.');
        if (w.whitespaceHeavy) msgs.push('There is a lot of empty space around the artwork — try Auto Crop or less padding.');
        if (w.lowContrast) msgs.push('Contrast is low; the icon may be hard to see at small sizes.');
        if (w.blurry) msgs.push('The source looks soft or blurry once resized.');
        if (w.fineDetail) msgs.push('Fine detail is present that may disappear at 16 to 32px — consider simplifying the artwork.');
        return msgs;
    });

    ngOnInit(): void {
        this.seo.update({
            title: 'Favicon Generator | Dev Tools',
            description:
                'Turn any image into a complete favicon package: crop, pad, recolor and preview across browsers and devices, then export favicon.ico, PNGs, manifests and a ready-to-paste HTML snippet.',
            url: '/tools/favicon',
            keywords: 'favicon generator, ico generator, create favicon, favicon.ico, apple touch icon, web manifest',
        });
    }

    // --- Upload -----------------------------------------------------------------

    async onFileInput(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        await this.addFiles(Array.from(input.files ?? []));
        input.value = '';
    }

    async onDrop(event: DragEvent): Promise<void> {
        event.preventDefault();
        this.dragOver.set(false);
        const files = Array.from(event.dataTransfer?.files ?? []).filter(
            (f) => f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.svg'),
        );
        await this.addFiles(files);
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
    async onPaste(event: ClipboardEvent): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const files = Array.from(event.clipboardData?.items ?? [])
            .filter((i) => i.kind === 'file')
            .map((i) => i.getAsFile())
            .filter((f): f is File => !!f);
        if (files.length) {
            event.preventDefault();
            await this.addFiles(files);
        }
    }

    @HostListener('window:keydown', ['$event'])
    onKeydown(event: KeyboardEvent): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const target = event.target as HTMLElement | null;
        const typing = !!target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            if (this.items().length) void this.downloadZip();
            return;
        }
        if (event.key === 'Delete' && !typing && this.selectedId()) {
            this.removeSelected();
        }
    }

    private async addFiles(files: File[]): Promise<void> {
        if (!isPlatformBrowser(this.platformId) || !files.length) return;
        this.error.set(null);
        for (const file of files) {
            try {
                const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
                const svgText = isSvg ? await file.text() : null;
                const canvas = await decodeToCanvas(file);
                const item: FaviconItem = {
                    id: crypto.randomUUID(),
                    name: file.name.replace(/\.[^./]+$/, '') || 'favicon',
                    sourceCanvas: canvas,
                    thumbUrl: canvasToPngDataUrl(canvas),
                    warnings: analyzeImage(canvas),
                    bytesIn: file.size,
                    isSvg,
                    svgText,
                };
                this.items.update((list) => [...list, item]);
                if (!this.selectedId()) this.selectedId.set(item.id);
            } catch {
                this.error.set(`Could not read "${file.name}". Try a different image.`);
            }
        }
        this.api.reportUsage({ toolId: 'favicon-ico', action: 'upload', metadata: { count: files.length } });
    }

    async loadFromUrl(): Promise<void> {
        const url = this.urlInput().trim();
        if (!url || !isPlatformBrowser(this.platformId)) return;
        this.urlLoading.set(true);
        this.error.set(null);
        this.api.faviconFromUrl(url).subscribe({
            next: async (res) => {
                try {
                    const canvas = await decodeToCanvas(res.output);
                    const item: FaviconItem = {
                        id: crypto.randomUUID(),
                        name: this.hostnameOf(url),
                        sourceCanvas: canvas,
                        thumbUrl: canvasToPngDataUrl(canvas),
                        warnings: analyzeImage(canvas),
                        bytesIn: res.bytesIn,
                        isSvg: false,
                        svgText: null,
                    };
                    this.items.update((list) => [...list, item]);
                    if (!this.selectedId()) this.selectedId.set(item.id);
                    this.urlInput.set('');
                    this.api.reportUsage({ toolId: 'favicon-ico', action: 'favicon-extract' });
                } finally {
                    this.urlLoading.set(false);
                }
            },
            error: (err) => {
                this.urlLoading.set(false);
                this.error.set(err?.error?.message ?? 'Could not fetch a favicon from that URL.');
            },
        });
    }

    private hostnameOf(url: string): string {
        try {
            return new URL(url).hostname;
        } catch {
            return 'favicon';
        }
    }

    async onDarkFileInput(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file || !isPlatformBrowser(this.platformId)) return;
        const canvas = await decodeToCanvas(file);
        this.darkItem.set({ sourceCanvas: canvas, warnings: analyzeImage(canvas) });
    }

    clearDark(): void {
        this.darkItem.set(null);
    }

    async upscaleSelected(scale: 2 | 3 | 4): Promise<void> {
        const item = this.selectedItem();
        if (!item || !isPlatformBrowser(this.platformId) || this.upscaling()) return;
        this.upscaling.set(true);
        this.error.set(null);
        try {
            const blob = await canvasToPngBlob(item.sourceCanvas);
            const res = await firstValueFrom(this.api.upscaleImage(blob, scale));
            const canvas = await decodeToCanvas(res.output);
            this.manualRect.set(null);
            this.updateSelectedItem({
                sourceCanvas: canvas,
                thumbUrl: canvasToPngDataUrl(canvas),
                warnings: analyzeImage(canvas),
                bytesIn: res.bytesOut,
            });
            this.api.reportUsage({ toolId: 'favicon-ico', action: 'upscale', metadata: { scale } });
        } catch (err: any) {
            this.error.set(err?.error?.message ?? 'Upscale failed. Try a different image.');
        } finally {
            this.upscaling.set(false);
        }
    }

    private updateSelectedItem(patch: Partial<FaviconItem>): void {
        const id = this.selectedId();
        if (!id) return;
        this.items.update((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    }

    // --- Batch / selection --------------------------------------------------------

    selectItem(id: string): void {
        this.selectedId.set(id);
        this.manualRect.set(null);
    }

    removeSelected(): void {
        const id = this.selectedId();
        if (!id) return;
        const remaining = this.items().filter((i) => i.id !== id);
        this.items.set(remaining);
        this.selectedId.set(remaining[0]?.id ?? null);
        this.manualRect.set(null);
    }

    // --- Edit controls --------------------------------------------------------------

    setCropMode(mode: CropMode): void {
        this.cropMode.set(mode);
        if (mode !== 'manual') this.manualRect.set(null);
    }

    setCustomColor(color: string): void {
        this.customColor.set(color);
        this.background.set('custom');
        this.recentColors.update((list) => [color, ...list.filter((c) => c !== color)].slice(0, 8));
    }

    onCropPointerDown(event: PointerEvent, box: HTMLElement): void {
        if (this.cropMode() !== 'manual') return;
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        const rect = box.getBoundingClientRect();
        this.cropDragging = true;
        this.cropStart = {
            x: this.clamp(event.clientX - rect.left, 0, rect.width),
            y: this.clamp(event.clientY - rect.top, 0, rect.height),
        };
        this.updateManualRect(event, rect);
    }

    onCropPointerMove(event: PointerEvent, box: HTMLElement): void {
        if (!this.cropDragging) return;
        this.updateManualRect(event, box.getBoundingClientRect());
    }

    onCropPointerUp(): void {
        this.cropDragging = false;
    }

    private updateManualRect(event: PointerEvent, displayRect: DOMRect): void {
        const item = this.selectedItem();
        if (!item || displayRect.width === 0 || displayRect.height === 0) return;
        const curX = this.clamp(event.clientX - displayRect.left, 0, displayRect.width);
        const curY = this.clamp(event.clientY - displayRect.top, 0, displayRect.height);
        const x0 = Math.min(this.cropStart.x, curX);
        const y0 = Math.min(this.cropStart.y, curY);
        const x1 = Math.max(this.cropStart.x, curX);
        const y1 = Math.max(this.cropStart.y, curY);
        const scaleX = item.sourceCanvas.width / displayRect.width;
        const scaleY = item.sourceCanvas.height / displayRect.height;
        this.manualRect.set({
            x: Math.round(x0 * scaleX),
            y: Math.round(y0 * scaleY),
            width: Math.max(1, Math.round((x1 - x0) * scaleX)),
            height: Math.max(1, Math.round((y1 - y0) * scaleY)),
        });
    }

    private clamp(v: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, v));
    }

    // --- Composition --------------------------------------------------------------

    private compositeOpts(): Omit<CompositeOptions, 'size'> {
        return {
            paddingPct: this.paddingPct(),
            autoCenter: this.autoCenter(),
            background: this.background(),
            customColor: this.customColor(),
            cornerShape: this.cornerShape(),
        };
    }

    private buildMasterFor(item: FaviconItem): HTMLCanvasElement {
        const batch = this.isBatch();
        const mode = this.cropMode();
        const working =
            mode === 'auto' ? autoCropTransparent(item.sourceCanvas) :
            mode === 'manual' && !batch && this.manualRect() ? cropToRect(item.sourceCanvas, this.manualRect()!) :
            item.sourceCanvas;
        return compositeIcon(working, { ...this.compositeOpts(), size: 512 });
    }

    private buildDarkMaster(): HTMLCanvasElement | null {
        const dark = this.darkItem();
        if (!dark) return null;
        const working = this.cropMode() === 'auto' ? autoCropTransparent(dark.sourceCanvas) : dark.sourceCanvas;
        return compositeIcon(working, { ...this.compositeOpts(), size: 512 });
    }

    // --- Tabs / preview controls --------------------------------------------------

    setTab(tab: EditorTab): void {
        this.tab.set(tab);
    }

    setZoomSize(size: number): void {
        this.zoomSize.set(size);
    }

    setZoomLevel(level: number): void {
        this.zoomLevel.set(level);
    }

    // --- Export -----------------------------------------------------------------

    async quickDownloadIco(): Promise<void> {
        const item = this.selectedItem();
        const master = this.masterCanvas();
        if (!item || !master || !isPlatformBrowser(this.platformId)) return;
        this.loading.set(true);
        this.error.set(null);
        try {
            const blob = await canvasToPngBlob(resizeSquare(master, 256));
            const res = await firstValueFrom(this.api.faviconIco(blob));
            const icoBlob = await dataUrlToBlob(res.output);
            downloadBlob(icoBlob, `${this.sanitizeName(item.name)}.ico`);
            this.api.reportUsage({ toolId: 'favicon-ico', action: 'download-ico' });
        } catch (err: any) {
            this.error.set(err?.error?.message ?? 'Favicon generation failed. Try a different image.');
        } finally {
            this.loading.set(false);
        }
    }

    async copySnippet(): Promise<void> {
        if (await copyText(this.htmlSnippet())) {
            this.copiedHtml.set(true);
            setTimeout(() => this.copiedHtml.set(false), 1400);
            this.api.reportUsage({ toolId: 'favicon-ico', action: 'copy-html' });
        }
    }

    async downloadZip(): Promise<void> {
        if (!isPlatformBrowser(this.platformId) || !this.items().length) return;
        this.exporting.set(true);
        this.error.set(null);
        try {
            const batch = this.isBatch();
            const entries: ZipEntry[] = [];
            const hasDark = !batch && !!this.darkMasterCanvas();

            for (const item of this.items()) {
                const master = this.buildMasterFor(item);
                const prefix = batch ? `${this.sanitizeName(item.name)}/` : '';

                const icoSourceBlob = await canvasToPngBlob(resizeSquare(master, 256));
                const icoResult = await firstValueFrom(this.api.faviconIco(icoSourceBlob));
                entries.push({ path: `${prefix}favicon.ico`, data: await dataUrlToBlob(icoResult.output) });

                entries.push({ path: `${prefix}favicon-16x16.png`, data: await canvasToPngBlob(resizeSquare(master, 16)) });
                entries.push({ path: `${prefix}favicon-32x32.png`, data: await canvasToPngBlob(resizeSquare(master, 32)) });
                entries.push({ path: `${prefix}apple-touch-icon.png`, data: await canvasToPngBlob(resizeSquare(master, 180)) });
                entries.push({ path: `${prefix}android-chrome-192x192.png`, data: await canvasToPngBlob(resizeSquare(master, 192)) });
                entries.push({ path: `${prefix}android-chrome-512x512.png`, data: await canvasToPngBlob(resizeSquare(master, 512)) });
                entries.push({ path: `${prefix}mstile-150x150.png`, data: await canvasToPngBlob(resizeSquare(master, 150)) });

                for (const size of EXPORT_SIZES) {
                    entries.push({ path: `${prefix}png/icon-${size}.png`, data: await canvasToPngBlob(resizeSquare(master, size)) });
                }

                if (item.isSvg && item.svgText) {
                    entries.push({ path: `${prefix}favicon.svg`, data: item.svgText });
                }

                const manifestOpts = { siteName: this.siteName(), themeColor: this.themeColor(), backgroundColor: this.themeColor() };
                entries.push({ path: `${prefix}site.webmanifest`, data: buildWebManifest(manifestOpts) });
                entries.push({ path: `${prefix}manifest.json`, data: buildManifestJson(manifestOpts) });
                entries.push({ path: `${prefix}browserconfig.xml`, data: buildBrowserConfigXml(this.themeColor()) });

                if (hasDark) {
                    const darkMaster = this.darkMasterCanvas()!;
                    entries.push({ path: `${prefix}favicon-32x32-dark.png`, data: await canvasToPngBlob(resizeSquare(darkMaster, 32)) });
                }

                entries.push({
                    path: `${prefix}html-snippet.html`,
                    data: buildHtmlSnippet({ themeColor: this.themeColor(), hasDarkVariant: hasDark }),
                });
            }

            entries.push({ path: 'README.txt', data: buildReadme(hasDark, batch) });

            const blob = await buildZip(entries);
            const filename = batch ? 'favicon-packs.zip' : 'favicon-package.zip';
            downloadBlob(blob, filename);

            this.exportHistory.update((list) => [
                { time: new Date().toLocaleTimeString(), label: batch ? `${this.items().length} favicon packs` : filename },
                ...list,
            ].slice(0, 10));
            this.api.reportUsage({ toolId: 'favicon-ico', action: 'export-zip', metadata: { batch, count: this.items().length } });
        } catch (err: any) {
            this.error.set(err?.error?.message ?? 'Could not build the favicon package. Try again.');
        } finally {
            this.exporting.set(false);
        }
    }

    private sanitizeName(name: string): string {
        return name.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'favicon';
    }

    formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
}
