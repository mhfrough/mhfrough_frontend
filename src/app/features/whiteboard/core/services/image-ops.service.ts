import { Injectable, computed, signal } from '@angular/core';
import { ImageElement, WhiteboardElement, generateElementId } from '../models/element.model';
import { DEFAULT_STYLE } from '../models/style.model';
import { SceneService } from './scene.service';
import { HistoryService } from './history.service';
import { SelectionService } from './selection.service';
import {
    CombineOp,
    bakeBoolean,
    bakeCrop,
    centerCropFraction,
    loadImage,
    rasterizeElement,
} from '../utils/image-ops.util';

/** A world-space rectangle. */
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const MIN_CROP = 12;

/**
 * Image editing operations (crop, mask, boolean compose) plus the interactive
 * crop-mode state. Every op bakes to a new PNG so all renderers stay consistent;
 * `originalSrc` is preserved so edits can be reset.
 */
@Injectable()
export class ImageOpsService {
    /** The image currently in interactive crop mode, or null. */
    readonly cropTarget = signal<ImageElement | null>(null);
    /** Live crop rectangle in world coords while cropping. */
    readonly cropRect = signal<Rect | null>(null);
    /** Optional locked aspect ratio (w/h) for the interactive crop, or null for free. */
    readonly cropRatio = signal<number | null>(null);

    readonly cropping = computed(() => this.cropTarget() !== null);

    constructor(
        private readonly scene: SceneService,
        private readonly history: HistoryService,
        private readonly selection: SelectionService,
    ) {}

    // --- one-click ratio crop --------------------------------------------------

    /** Center-crop `el` to the given aspect ratio (w / h). */
    async autoCrop(el: ImageElement, ratio: number): Promise<void> {
        const frac = centerCropFraction(el.naturalWidth || el.width, el.naturalHeight || el.height, ratio);
        const baked = await bakeCrop(el.src, frac);
        const width = el.width * frac.w;
        const height = el.height * frac.h;
        this.scene.updateElement(el.id, {
            src: baked.src,
            naturalWidth: baked.naturalWidth,
            naturalHeight: baked.naturalHeight,
            width,
            height,
            x: el.x + el.width * frac.x,
            y: el.y + el.height * frac.y,
            originalSrc: el.originalSrc ?? el.src,
        } as Partial<WhiteboardElement>);
        this.history.commit();
    }

    // --- interactive crop ------------------------------------------------------

    startCrop(el: ImageElement): void {
        this.cropTarget.set(el);
        this.cropRatio.set(null);
        this.cropRect.set({ x: el.x, y: el.y, width: el.width, height: el.height });
    }

    /** Constrain the interactive crop to a ratio (centered on the current rect), or free (null). */
    setCropRatio(ratio: number | null): void {
        this.cropRatio.set(ratio);
        const el = this.cropTarget();
        if (!el || ratio === null) return;
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        let w = el.width;
        let h = w / ratio;
        if (h > el.height) { h = el.height; w = h * ratio; }
        this.cropRect.set(this.clampToImage(el, { x: cx - w / 2, y: cy - h / 2, width: w, height: h }));
    }

    setCropRect(rect: Rect): void {
        const el = this.cropTarget();
        if (!el) return;
        this.cropRect.set(this.clampToImage(el, rect));
    }

    async applyCrop(): Promise<void> {
        const el = this.cropTarget();
        const rect = this.cropRect();
        this.cropTarget.set(null);
        this.cropRect.set(null);
        if (!el || !rect) return;

        const frac = {
            x: (rect.x - el.x) / el.width,
            y: (rect.y - el.y) / el.height,
            w: rect.width / el.width,
            h: rect.height / el.height,
        };
        const baked = await bakeCrop(el.src, frac);
        this.scene.updateElement(el.id, {
            src: baked.src,
            naturalWidth: baked.naturalWidth,
            naturalHeight: baked.naturalHeight,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            originalSrc: el.originalSrc ?? el.src,
        } as Partial<WhiteboardElement>);
        this.history.commit();
    }

    cancelCrop(): void {
        this.cropTarget.set(null);
        this.cropRect.set(null);
    }

    // --- combine (boolean + mask) on any two objects ---------------------------

    /**
     * Union / intersect / subtract / exclude / mask the two selected objects. Both are
     * flattened to rasters (so shapes, text and images combine uniformly) and the result
     * replaces them with a single image, ordered back→front to match XD/Figma.
     */
    async combineSelected(op: CombineOp): Promise<void> {
        const sel = this.selection.selectedElements();
        if (sel.length !== 2) return;
        const order = this.scene.elements();
        const [back, front] = [...sel].sort((a, b) => order.indexOf(a) - order.indexOf(b));
        const [rasterBack, rasterFront] = await Promise.all([rasterizeElement(back), rasterizeElement(front)]);
        const baked = await bakeBoolean(rasterBack, rasterFront, op);
        const now = Date.now();
        const el: ImageElement = {
            id: generateElementId(),
            type: 'image',
            x: baked.x,
            y: baked.y,
            width: baked.width,
            height: baked.height,
            rotation: 0,
            style: { ...DEFAULT_STYLE },
            locked: false,
            groupId: null,
            createdAt: now,
            updatedAt: now,
            src: baked.src,
            naturalWidth: baked.naturalWidth,
            naturalHeight: baked.naturalHeight,
            flipH: false,
            flipV: false,
        };
        this.scene.removeElements(new Set([back.id, front.id]));
        this.scene.addElement(el);
        this.selection.select(el.id);
        this.history.commit();
    }

    // --- reset -----------------------------------------------------------------

    async resetImage(el: ImageElement): Promise<void> {
        if (!el.originalSrc) return;
        const img = await loadImage(el.originalSrc);
        const nw = img.naturalWidth || el.naturalWidth;
        const nh = img.naturalHeight || el.naturalHeight;
        this.scene.updateElement(el.id, {
            src: el.originalSrc,
            originalSrc: undefined,
            naturalWidth: nw,
            naturalHeight: nh,
            height: el.width * (nh / nw),
        } as Partial<WhiteboardElement>);
        this.history.commit();
    }

    // --- helpers ---------------------------------------------------------------

    private clampToImage(el: ImageElement, rect: Rect): Rect {
        const width = Math.min(Math.max(MIN_CROP, rect.width), el.width);
        const height = Math.min(Math.max(MIN_CROP, rect.height), el.height);
        const x = Math.min(Math.max(el.x, rect.x), el.x + el.width - width);
        const y = Math.min(Math.max(el.y, rect.y), el.y + el.height - height);
        return { x, y, width, height };
    }
}
