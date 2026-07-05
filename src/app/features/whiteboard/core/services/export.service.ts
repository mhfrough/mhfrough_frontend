import { Injectable } from '@angular/core';
import { SceneService } from './scene.service';
import { HistoryService } from './history.service';
import { WhiteboardElement } from '../models/element.model';
import { preloadImages, renderToCanvas } from '../utils/canvas-render.util';
import { exportSceneToSvg } from '../utils/svg-export.util';
import { Orientation, PageSize, buildJpegPdf } from '../utils/pdf-export.util';

const DOC_BACKGROUND = '#1a1917';
const FILE_VERSION = 1;

interface WhiteboardFile {
    type: 'mhfrough-whiteboard';
    version: number;
    elements: WhiteboardElement[];
}

/** Orchestrates all export/import formats. Stateless beyond the scene it reads. */
@Injectable()
export class ExportService {
    constructor(private readonly scene: SceneService, private readonly history: HistoryService) {}

    private get elements(): readonly WhiteboardElement[] {
        return this.scene.elements();
    }

    private hasContent(): boolean {
        return this.elements.length > 0;
    }

    // --- JSON ----------------------------------------------------------------
    exportJson(): void {
        const file: WhiteboardFile = { type: 'mhfrough-whiteboard', version: FILE_VERSION, elements: [...this.elements] };
        this.download(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }), 'whiteboard.json');
    }

    async importJson(file: File): Promise<void> {
        const text = await file.text();
        const parsed = JSON.parse(text) as Partial<WhiteboardFile>;
        if (!parsed || !Array.isArray(parsed.elements)) {
            throw new Error('Invalid whiteboard file');
        }
        this.scene.replaceAll(parsed.elements as WhiteboardElement[]);
        this.history.reset();
    }

    // --- Raster --------------------------------------------------------------
    async exportPng(transparent = false): Promise<void> {
        if (!this.hasContent()) return;
        const images = await preloadImages(this.elements);
        const { canvas } = renderToCanvas(this.elements, { background: transparent ? null : DOC_BACKGROUND }, images);
        const blob = await this.toBlob(canvas, 'image/png');
        this.download(blob, 'whiteboard.png');
    }

    async exportJpeg(): Promise<void> {
        if (!this.hasContent()) return;
        const images = await preloadImages(this.elements);
        const { canvas } = renderToCanvas(this.elements, { background: DOC_BACKGROUND }, images);
        const blob = await this.toBlob(canvas, 'image/jpeg', 0.92);
        this.download(blob, 'whiteboard.jpg');
    }

    // --- SVG -----------------------------------------------------------------
    exportSvg(): void {
        if (!this.hasContent()) return;
        const svg = exportSceneToSvg(this.elements, DOC_BACKGROUND);
        this.download(new Blob([svg], { type: 'image/svg+xml' }), 'whiteboard.svg');
    }

    // --- PDF -----------------------------------------------------------------
    async exportPdf(size: PageSize = 'A4', orientation: Orientation = 'landscape'): Promise<void> {
        if (!this.hasContent()) return;
        const images = await preloadImages(this.elements);
        const { canvas } = renderToCanvas(this.elements, { background: DOC_BACKGROUND }, images);
        const blob = await this.toBlob(canvas, 'image/jpeg', 0.92);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const pdf = buildJpegPdf(bytes, canvas.width, canvas.height, size, orientation);
        this.download(pdf, 'whiteboard.pdf');
    }

    // --- Clipboard -----------------------------------------------------------
    async copyPngToClipboard(): Promise<void> {
        if (!this.hasContent()) return;
        const images = await preloadImages(this.elements);
        const { canvas } = renderToCanvas(this.elements, { background: DOC_BACKGROUND }, images);
        const blob = await this.toBlob(canvas, 'image/png');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    }

    // --- Print ---------------------------------------------------------------
    async print(size: PageSize = 'A4', orientation: Orientation = 'landscape'): Promise<void> {
        if (!this.hasContent()) return;
        const images = await preloadImages(this.elements);
        const { canvas } = renderToCanvas(this.elements, { background: DOC_BACKGROUND }, images);
        const dataUrl = canvas.toDataURL('image/png');
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<!doctype html><html><head><title>Whiteboard</title>
<style>@page{size:${size} ${orientation};margin:10mm}
html,body{margin:0;height:100%}
img{max-width:100%;max-height:100vh;display:block;margin:auto}</style></head>
<body><img src="${dataUrl}" onload="window.focus();window.print();"/></body></html>`);
        win.document.close();
    }

    // --- helpers -------------------------------------------------------------
    private toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))), type, quality);
        });
    }

    private download(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
