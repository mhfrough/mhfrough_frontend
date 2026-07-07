import { Injectable } from '@angular/core';
import { SceneService } from './scene.service';
import { HistoryService } from './history.service';
import { SelectionService } from './selection.service';
import { WhiteboardElement, generateElementId } from '../models/element.model';
import { preloadImages, renderToCanvas } from '../utils/canvas-render.util';
import { exportSceneToSvg } from '../utils/svg-export.util';
import { Orientation, PageSize, buildJpegPdf } from '../utils/pdf-export.util';

const DOC_BACKGROUND = '#1a1917';
const FILE_VERSION = 1;
/** Offset applied to placed / imported objects so they don't sit exactly on the source. */
const PLACE_OFFSET = 24;

interface WhiteboardFile {
    type: 'mhfrough-whiteboard';
    version: number;
    elements: WhiteboardElement[];
}

/** Orchestrates all export/import formats. Stateless beyond the scene it reads. */
@Injectable()
export class ExportService {
    constructor(
        private readonly scene: SceneService,
        private readonly history: HistoryService,
        private readonly selection: SelectionService,
    ) {}

    private get elements(): readonly WhiteboardElement[] {
        return this.scene.elements();
    }

    private hasContent(): boolean {
        return this.elements.length > 0;
    }

    /** Elements to export: the current selection if any, otherwise the whole scene. */
    private target(selectionOnly: boolean): readonly WhiteboardElement[] {
        return selectionOnly ? this.selection.selectedElements() : this.elements;
    }

    // --- JSON ----------------------------------------------------------------
    exportJson(selectionOnly = false): void {
        const els = this.target(selectionOnly);
        if (!els.length) return;
        const file: WhiteboardFile = { type: 'mhfrough-whiteboard', version: FILE_VERSION, elements: [...els] };
        this.download(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }), selectionOnly ? 'object.json' : 'whiteboard.json');
    }

    /** Replace the whole board with a loaded file. */
    async importJson(file: File): Promise<void> {
        const parsed = await this.readFile(file);
        this.scene.replaceAll(parsed);
        this.history.reset();
    }

    /** Add a loaded file's elements to the board as new objects (Figma-style "place"). */
    async importObject(file: File): Promise<void> {
        const parsed = await this.readFile(file);
        const clones = parsed.map(el => ({
            ...el,
            ...('points' in el ? { points: el.points.map(p => ({ x: p.x + PLACE_OFFSET, y: p.y + PLACE_OFFSET })) } : {}),
            id: generateElementId(),
            x: el.x + PLACE_OFFSET,
            y: el.y + PLACE_OFFSET,
            groupId: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        } as WhiteboardElement));
        clones.forEach(c => this.scene.addElement(c));
        this.selection.selectMany(clones.map(c => c.id));
        this.history.commit();
    }

    private async readFile(file: File): Promise<WhiteboardElement[]> {
        const parsed = JSON.parse(await file.text()) as Partial<WhiteboardFile>;
        if (!parsed || !Array.isArray(parsed.elements)) {
            throw new Error('Invalid whiteboard file');
        }
        return parsed.elements as WhiteboardElement[];
    }

    // --- Raster --------------------------------------------------------------
    async exportPng(transparent = false, selectionOnly = false): Promise<void> {
        const els = this.target(selectionOnly);
        if (!els.length) return;
        const images = await preloadImages(els);
        const { canvas } = renderToCanvas(els, { background: transparent ? null : DOC_BACKGROUND }, images);
        const blob = await this.toBlob(canvas, 'image/png');
        this.download(blob, selectionOnly ? 'object.png' : 'whiteboard.png');
    }

    /** Export each selected element as its own PNG file. */
    async exportSelectionPngEach(): Promise<void> {
        const els = this.selection.selectedElements();
        for (let i = 0; i < els.length; i++) {
            const images = await preloadImages([els[i]]);
            const { canvas } = renderToCanvas([els[i]], { background: null }, images);
            const blob = await this.toBlob(canvas, 'image/png');
            this.download(blob, `object-${i + 1}.png`);
        }
    }

    /** Export each selected element as its own SVG file. */
    exportSelectionSvgEach(): void {
        const els = this.selection.selectedElements();
        els.forEach((el, i) => {
            const svg = exportSceneToSvg([el], null);
            this.download(new Blob([svg], { type: 'image/svg+xml' }), `object-${i + 1}.svg`);
        });
    }

    async exportJpeg(): Promise<void> {
        if (!this.hasContent()) return;
        const images = await preloadImages(this.elements);
        const { canvas } = renderToCanvas(this.elements, { background: DOC_BACKGROUND }, images);
        const blob = await this.toBlob(canvas, 'image/jpeg', 0.92);
        this.download(blob, 'whiteboard.jpg');
    }

    // --- SVG -----------------------------------------------------------------
    exportSvg(selectionOnly = false): void {
        const els = this.target(selectionOnly);
        if (!els.length) return;
        // Selection exports get a transparent background so the object drops cleanly onto anything.
        const svg = exportSceneToSvg(els, selectionOnly ? null : DOC_BACKGROUND);
        this.download(new Blob([svg], { type: 'image/svg+xml' }), selectionOnly ? 'object.svg' : 'whiteboard.svg');
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
