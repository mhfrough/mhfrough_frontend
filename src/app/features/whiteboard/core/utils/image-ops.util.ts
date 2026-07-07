import { ImageElement, WhiteboardElement, isImageElement } from '../models/element.model';
import { diamondPoints, polygonPoints, starPoints, trianglePoints } from './shape-geometry.util';
import { preloadImages, renderToCanvas } from './canvas-render.util';

/** Result of a canvas bake: a self-contained PNG data-URL plus its pixel dimensions. */
export interface BakedImage {
    src: string;
    naturalWidth: number;
    naturalHeight: number;
}

/** A baked image plus the world box it should occupy. */
export interface PlacedImage extends BakedImage {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Minimal shape any element can be flattened to for compositing. */
export interface RasterSource {
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    naturalWidth: number;
    flipH: boolean;
    flipV: boolean;
}

export type BooleanOp = 'union' | 'intersect' | 'subtract' | 'exclude';
/** Boolean ops plus "mask" (front object's shape reveals the back object). */
export type CombineOp = BooleanOp | 'mask';

/** Flatten any element to a PNG raster of its bounding box, so shapes/text/images compose uniformly. */
export async function rasterizeElement(el: WhiteboardElement): Promise<RasterSource> {
    const images = isImageElement(el) ? await preloadImages([el]) : undefined;
    const { canvas, bounds } = renderToCanvas([el], { padding: 2, background: null, scale: 2 }, images);
    return {
        src: canvas.toDataURL('image/png'),
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        naturalWidth: canvas.width,
        flipH: false,
        flipV: false,
    };
}

/** Shapes that can be used as an image mask (closed, fillable outlines). */
export type MaskShape = Extract<WhiteboardElement, { type: 'rectangle' | 'ellipse' | 'diamond' | 'triangle' | 'star' | 'polygon' }>;

/** Cap on the longest side of a baked canvas, to keep data-URLs and memory sane. */
const MAX_BAKE_SIDE = 4096;
/** Cap on upscaling so a small source isn't blown up into a huge canvas. */
const MAX_DENSITY = 4;

export function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to decode image'));
        img.src = src;
    });
}

/** Centered source rectangle (as 0..1 fractions) with the given aspect ratio (w/h). */
export function centerCropFraction(naturalWidth: number, naturalHeight: number, ratio: number): { x: number; y: number; w: number; h: number } {
    const imgRatio = naturalWidth / naturalHeight;
    let cw: number;
    let ch: number;
    if (imgRatio > ratio) {
        ch = naturalHeight;
        cw = naturalHeight * ratio;
    } else {
        cw = naturalWidth;
        ch = naturalWidth / ratio;
    }
    return {
        x: (naturalWidth - cw) / 2 / naturalWidth,
        y: (naturalHeight - ch) / 2 / naturalHeight,
        w: cw / naturalWidth,
        h: ch / naturalHeight,
    };
}

/** Crop `src` to the given 0..1 fractional rectangle, returning a new PNG. */
export async function bakeCrop(src: string, frac: { x: number; y: number; w: number; h: number }): Promise<BakedImage> {
    const img = await loadImage(src);
    const nw = img.naturalWidth || 1;
    const nh = img.naturalHeight || 1;
    const sx = clamp01(frac.x) * nw;
    const sy = clamp01(frac.y) * nh;
    const sw = Math.max(1, clamp01(frac.w) * nw);
    const sh = Math.max(1, clamp01(frac.h) * nh);
    const cw = Math.max(1, Math.round(sw));
    const ch = Math.max(1, Math.round(sh));
    const { canvas, ctx } = makeCanvas(cw, ch);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    return { src: canvas.toDataURL('image/png'), naturalWidth: cw, naturalHeight: ch };
}

/** Clip `image` to `shape`'s outline, producing a transparent-edged PNG the size of the shape's box. */
export async function bakeMask(image: ImageElement, shape: MaskShape): Promise<PlacedImage> {
    const img = await loadImage(image.src);
    const boxW = shape.width;
    const boxH = shape.height;
    const density = pickDensity(image, boxW, boxH);
    const cw = Math.max(1, Math.round(boxW * density));
    const ch = Math.max(1, Math.round(boxH * density));
    const { canvas, ctx } = makeCanvas(cw, ch);

    ctx.scale(density, density);
    ctx.beginPath();
    traceShape(ctx, shape, boxW, boxH);
    ctx.clip();
    drawElementImage(ctx, image, img, shape.x, shape.y);

    return {
        src: canvas.toDataURL('image/png'),
        naturalWidth: cw,
        naturalHeight: ch,
        x: shape.x,
        y: shape.y,
        width: boxW,
        height: boxH,
    };
}

/**
 * Combine two flattened rasters with a boolean/mask op, producing one PNG over their combined box.
 * `a` is the back (lower) object, `b` the front (upper) — this ordering makes subtract/mask match XD/Figma.
 */
export async function bakeBoolean(a: RasterSource, b: RasterSource, op: CombineOp): Promise<PlacedImage> {
    const [ia, ib] = await Promise.all([loadImage(a.src), loadImage(b.src)]);
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x + a.width, b.x + b.width);
    const maxY = Math.max(a.y + a.height, b.y + b.height);
    const boxW = maxX - minX;
    const boxH = maxY - minY;
    const density = Math.min(
        Math.max(densityOf(a), densityOf(b)),
        MAX_DENSITY,
        MAX_BAKE_SIDE / Math.max(boxW, boxH),
    );
    const cw = Math.max(1, Math.round(boxW * density));
    const ch = Math.max(1, Math.round(boxH * density));
    const { canvas, ctx } = makeCanvas(cw, ch);
    ctx.scale(density, density);

    drawElementImage(ctx, a, ia, minX, minY);
    ctx.globalCompositeOperation = compositeFor(op);
    drawElementImage(ctx, b, ib, minX, minY);
    ctx.globalCompositeOperation = 'source-over';

    return {
        src: canvas.toDataURL('image/png'),
        naturalWidth: cw,
        naturalHeight: ch,
        x: minX,
        y: minY,
        width: boxW,
        height: boxH,
    };
}

// --- internals ---------------------------------------------------------------

function compositeFor(op: CombineOp): GlobalCompositeOperation {
    switch (op) {
        case 'intersect': return 'source-in';
        case 'subtract': return 'destination-out';
        case 'exclude': return 'xor';
        case 'mask': return 'destination-in';
        default: return 'source-over';
    }
}

/** Draw an element's image into a context whose origin is at world (originX, originY). */
function drawElementImage(
    ctx: CanvasRenderingContext2D,
    el: RasterSource,
    img: HTMLImageElement,
    originX: number,
    originY: number,
): void {
    ctx.save();
    ctx.translate(el.x - originX + el.width / 2, el.y - originY + el.height / 2);
    ctx.scale(el.flipH ? -1 : 1, el.flipV ? -1 : 1);
    ctx.drawImage(img, -el.width / 2, -el.height / 2, el.width, el.height);
    ctx.restore();
}

/** Source pixels per world unit for a raster source. */
function densityOf(el: RasterSource): number {
    return el.width > 0 ? (el.naturalWidth || el.width) / el.width : 1;
}

function pickDensity(image: ImageElement, boxW: number, boxH: number): number {
    return Math.max(0.1, Math.min(densityOf(image), MAX_DENSITY, MAX_BAKE_SIDE / Math.max(boxW, boxH)));
}

/** Trace `shape`'s outline into the current path, in local coords (0,0)..(w,h). */
function traceShape(ctx: CanvasRenderingContext2D, shape: MaskShape, w: number, h: number): void {
    switch (shape.type) {
        case 'ellipse':
            ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            return;
        case 'diamond':
            tracePolyString(ctx, diamondPoints(w, h));
            return;
        case 'triangle':
            tracePolyString(ctx, trianglePoints(w, h));
            return;
        case 'star':
            tracePolyString(ctx, starPoints(w, h));
            return;
        case 'polygon':
            tracePolyString(ctx, polygonPoints(w, h, shape.sides));
            return;
        case 'rectangle':
        default: {
            const r = Math.min(shape.style.cornerRadius || 0, w / 2, h / 2);
            traceRoundRect(ctx, w, h, r);
            return;
        }
    }
}

function tracePolyString(ctx: CanvasRenderingContext2D, points: string): void {
    const coords = points.trim().split(/\s+/).map(pair => pair.split(',').map(Number));
    coords.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
}

function traceRoundRect(ctx: CanvasRenderingContext2D, w: number, h: number, r: number): void {
    if (r <= 0) {
        ctx.rect(0, 0, w, h);
        return;
    }
    ctx.moveTo(r, 0);
    ctx.arcTo(w, 0, w, h, r);
    ctx.arcTo(w, h, 0, h, r);
    ctx.arcTo(0, h, 0, 0, r);
    ctx.arcTo(0, 0, w, 0, r);
    ctx.closePath();
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    return { canvas, ctx };
}

function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}
