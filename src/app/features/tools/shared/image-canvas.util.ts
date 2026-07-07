/**
 * SSR-safe client-side canvas pipeline for the favicon editor. Every function
 * here touches the DOM (canvas/Image/URL) and must only run in the browser —
 * callers are responsible for guarding with isPlatformBrowser first.
 */

export type BackgroundKind = 'transparent' | 'white' | 'black' | 'custom' | 'auto';
export type CornerShape = 'square' | 'rounded' | 'circle' | 'squircle';

export interface CropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface CompositeOptions {
    paddingPct: number;
    autoCenter: boolean;
    background: BackgroundKind;
    customColor: string;
    cornerShape: CornerShape;
    size: number;
}

export interface ImageWarnings {
    tooSmall: boolean;
    nonSquare: boolean;
    lowRes: boolean;
    transparent: boolean;
    whitespaceHeavy: boolean;
    lowContrast: boolean;
    blurry: boolean;
    fineDetail: boolean;
}

const MAX_DECODE_DIMENSION = 2048;

function newCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
}

function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const c = canvas.getContext('2d');
    if (!c) throw new Error('Canvas 2D context unavailable.');
    return c;
}

/** Decode a File, Blob, data URL, or remote URL into a fresh working canvas. */
export async function decodeToCanvas(source: File | Blob | string): Promise<HTMLCanvasElement> {
    const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
    const src = objectUrl ?? (source as string);
    try {
        const img = await loadImage(src);
        const scale = Math.min(1, MAX_DECODE_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = newCanvas(img.naturalWidth * scale, img.naturalHeight * scale);
        const c = ctx2d(canvas);
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas;
    } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not decode image.'));
        img.src = src;
    });
}

function getImageData(canvas: HTMLCanvasElement): ImageData {
    return ctx2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
}

/** True if the canvas has any meaningfully transparent pixels. */
export function hasTransparency(canvas: HTMLCanvasElement): boolean {
    const { data } = getImageData(canvas);
    for (let i = 3; i < data.length; i += 4 * 17) {
        if (data[i] < 250) return true;
    }
    return false;
}

/** Trim fully-transparent border pixels down to the opaque content's bounding box. */
export function autoCropTransparent(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const { data, width, height } = getImageData(canvas);
    let top = height, bottom = -1, left = width, right = -1;
    const alphaThreshold = 8;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const a = data[(y * width + x) * 4 + 3];
            if (a > alphaThreshold) {
                if (y < top) top = y;
                if (y > bottom) bottom = y;
                if (x < left) left = x;
                if (x > right) right = x;
            }
        }
    }

    if (bottom < top || right < left) return canvas;
    const cropWidth = right - left + 1;
    const cropHeight = bottom - top + 1;
    if (cropWidth === width && cropHeight === height) return canvas;

    return cropToRect(canvas, { x: left, y: top, width: cropWidth, height: cropHeight });
}

export function cropToRect(canvas: HTMLCanvasElement, rect: CropRect): HTMLCanvasElement {
    const out = newCanvas(rect.width, rect.height);
    ctx2d(out).drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    return out;
}

/** Average colour of the outermost ring of pixels — used for the "auto" background option. */
export function dominantEdgeColor(canvas: HTMLCanvasElement): string {
    const { data, width, height } = getImageData(canvas);
    let r = 0, g = 0, b = 0, n = 0;
    const sample = (x: number, y: number) => {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 8) return;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    };
    for (let x = 0; x < width; x++) { sample(x, 0); sample(x, height - 1); }
    for (let y = 0; y < height; y++) { sample(0, y); sample(width - 1, y); }
    if (n === 0) return '#ffffff';
    const h = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
}

/** Best-effort quality warnings shown as non-blocking suggestions, not hard errors. */
export function analyzeImage(canvas: HTMLCanvasElement): ImageWarnings {
    const { width, height } = canvas;
    const aspectSkew = Math.abs(width - height) / Math.max(width, height);
    const gray = toGrayscale(canvas, 64);

    return {
        tooSmall: Math.min(width, height) < 48,
        nonSquare: aspectSkew > 0.05,
        lowRes: Math.min(width, height) < 128,
        transparent: hasTransparency(canvas),
        whitespaceHeavy: whitespaceRatio(canvas) > 0.55,
        lowContrast: luminanceStdDev(gray) < 18,
        blurry: laplacianVariance(gray) < 40,
        fineDetail: edgeDensity(gray) > 0.35,
    };
}

function toGrayscale(canvas: HTMLCanvasElement, size: number): Float32Array {
    const small = newCanvas(size, size);
    ctx2d(small).drawImage(canvas, 0, 0, size, size);
    const { data } = getImageData(small);
    const out = new Float32Array(size * size);
    for (let i = 0; i < out.length; i++) {
        const o = i * 4;
        out[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    }
    return out;
}

function whitespaceRatio(canvas: HTMLCanvasElement): number {
    const { data } = getImageData(canvas);
    let near = 0, total = 0;
    for (let i = 0; i < data.length; i += 4 * 5) {
        const lightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (lightness > 235) near++;
        total++;
    }
    return total ? near / total : 0;
}

function luminanceStdDev(gray: Float32Array): number {
    const mean = gray.reduce((a, b) => a + b, 0) / gray.length;
    const variance = gray.reduce((a, b) => a + (b - mean) ** 2, 0) / gray.length;
    return Math.sqrt(variance);
}

/** Laplacian-variance sharpness estimate; low variance ≈ blurry/flat image. */
function laplacianVariance(gray: Float32Array): number {
    const size = Math.sqrt(gray.length);
    let sum = 0, sumSq = 0, n = 0;
    for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
            const i = y * size + x;
            const lap =
                4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - size] - gray[i + size];
            sum += lap; sumSq += lap * lap; n++;
        }
    }
    if (n === 0) return 0;
    const mean = sum / n;
    return sumSq / n - mean * mean;
}

/** Fraction of pixels that sit on a strong edge — proxy for fine detail that vanishes when shrunk. */
function edgeDensity(gray: Float32Array): number {
    const size = Math.sqrt(gray.length);
    let edges = 0, n = 0;
    for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
            const i = y * size + x;
            const gx = gray[i + 1] - gray[i - 1];
            const gy = gray[i + size] - gray[i - size];
            if (Math.sqrt(gx * gx + gy * gy) > 60) edges++;
            n++;
        }
    }
    return n ? edges / n : 0;
}

function applyCornerClip(c: CanvasRenderingContext2D, size: number, shape: CornerShape): void {
    if (shape === 'square') return;
    c.beginPath();
    if (shape === 'circle') {
        c.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    } else if (shape === 'rounded') {
        const r = size * 0.18;
        roundedRectPath(c, 0, 0, size, size, r);
    } else {
        squirclePath(c, size);
    }
    c.closePath();
    c.clip();
}

function roundedRectPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
}

/** Superellipse (squircle) outline approximated with an n=4 power curve. */
function squirclePath(c: CanvasRenderingContext2D, size: number): void {
    const n = 4;
    const cx = size / 2, cy = size / 2, r = size / 2;
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const ct = Math.cos(t), st = Math.sin(t);
        const x = cx + r * Math.sign(ct) * Math.abs(ct) ** (2 / n);
        const y = cy + r * Math.sign(st) * Math.abs(st) ** (2 / n);
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
}

/** Compose the final square icon: background, padding, centering, and corner mask. */
export function compositeIcon(source: HTMLCanvasElement, opts: CompositeOptions): HTMLCanvasElement {
    const { size } = opts;
    const out = newCanvas(size, size);
    const c = ctx2d(out);

    applyCornerClip(c, size, opts.cornerShape);

    if (opts.background !== 'transparent') {
        c.fillStyle =
            opts.background === 'white' ? '#ffffff' :
            opts.background === 'black' ? '#000000' :
            opts.background === 'auto' ? dominantEdgeColor(source) :
            opts.customColor;
        c.fillRect(0, 0, size, size);
    }

    const pad = Math.min(0.4, Math.max(0, opts.paddingPct / 100));
    const inner = size * (1 - pad * 2);
    const srcAspect = source.width / source.height;
    let drawW = inner, drawH = inner;
    if (srcAspect > 1) drawH = inner / srcAspect;
    else if (srcAspect < 1) drawW = inner * srcAspect;

    const x = opts.autoCenter ? (size - drawW) / 2 : size * pad;
    const y = opts.autoCenter ? (size - drawH) / 2 : size * pad;

    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(source, x, y, drawW, drawH);

    return out;
}

/** Downscale/upscale a composited icon to an exact square output size. */
export function resizeSquare(source: HTMLCanvasElement, size: number): HTMLCanvasElement {
    const out = newCanvas(size, size);
    const c = ctx2d(out);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(source, 0, 0, size, size);
    return out;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob); else reject(new Error('PNG encoding failed.'));
        }, 'image/png');
    });
}

export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL('image/png');
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
}
