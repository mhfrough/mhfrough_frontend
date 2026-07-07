import { WhiteboardElement, isImageElement } from '../models/element.model';
import { dashArrayFor } from '../models/style.model';
import { boundingBoxOfElements } from './hit-test.util';
import { polygonPoints, starPoints } from './shape-geometry.util';
import { stripHtml } from './text.util';

export interface RenderOptions {
    padding?: number;
    background?: string | null;
    scale?: number;
}

interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Decodes every image element's data-URL into an HTMLImageElement, keyed by element id.
 * Call before `renderToCanvas` so images can be drawn synchronously; failures are skipped.
 */
export async function preloadImages(
    elements: readonly WhiteboardElement[],
): Promise<Map<string, HTMLImageElement>> {
    const entries = await Promise.all(
        elements.filter(isImageElement).map(
            el => new Promise<[string, HTMLImageElement] | null>(resolve => {
                const img = new Image();
                img.onload = () => resolve([el.id, img]);
                img.onerror = () => resolve(null);
                img.src = el.src;
            }),
        ),
    );
    return new Map(entries.filter((entry): entry is [string, HTMLImageElement] => entry !== null));
}

/**
 * Rasterises the given elements onto a fresh 2D canvas. Returns the canvas + the world bounds used.
 * Pass the map from `preloadImages` to include image elements; without it they are skipped.
 */
export function renderToCanvas(
    elements: readonly WhiteboardElement[],
    opts: RenderOptions = {},
    images?: Map<string, HTMLImageElement>,
): { canvas: HTMLCanvasElement; bounds: Bounds } {
    const padding = opts.padding ?? 40;
    const scale = opts.scale ?? 2;
    const bbox = boundingBoxOfElements(elements);
    const bounds: Bounds = {
        x: bbox.x - padding,
        y: bbox.y - padding,
        width: Math.max(1, bbox.width + padding * 2),
        height: Math.max(1, bbox.height + padding * 2),
    };

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(bounds.width * scale);
    canvas.height = Math.ceil(bounds.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.translate(-bounds.x, -bounds.y);

    if (opts.background) {
        ctx.fillStyle = opts.background;
        ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    for (const el of elements) drawElement(ctx, el, images);
    return { canvas, bounds };
}

function drawElement(
    ctx: CanvasRenderingContext2D,
    el: WhiteboardElement,
    images?: Map<string, HTMLImageElement>,
): void {
    ctx.save();
    ctx.globalAlpha = el.style.opacity;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.translate(-el.width / 2, -el.height / 2);

    ctx.lineWidth = el.style.strokeWidth;
    ctx.strokeStyle = el.style.strokeColor;
    ctx.fillStyle = el.style.fillColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const dash = dashArrayFor(el.style);
    ctx.setLineDash(dash ? dash.split(' ').map(Number) : []);

    switch (el.type) {
        case 'rectangle': drawRect(ctx, el.width, el.height, el.style.cornerRadius, el.style.fillColor); break;
        case 'ellipse': drawEllipse(ctx, el.width, el.height, el.style.fillColor); break;
        case 'diamond': drawPolyStr(ctx, `${el.width / 2},0 ${el.width},${el.height / 2} ${el.width / 2},${el.height} 0,${el.height / 2}`, el.style.fillColor); break;
        case 'triangle': drawPolyStr(ctx, `${el.width / 2},0 ${el.width},${el.height} 0,${el.height}`, el.style.fillColor); break;
        case 'star': drawPolyStr(ctx, starPoints(el.width, el.height), el.style.fillColor); break;
        case 'polygon': drawPolyStr(ctx, polygonPoints(el.width, el.height, el.sides), el.style.fillColor); break;
        case 'line': drawPath(ctx, el); break;
        case 'arrow': drawPath(ctx, el); drawArrowHead(ctx, el, 'end'); break;
        case 'double-arrow': drawPath(ctx, el); drawArrowHead(ctx, el, 'end'); drawArrowHead(ctx, el, 'start'); break;
        case 'pencil': drawPath(ctx, el); break;
        case 'brush': ctx.lineWidth = el.style.strokeWidth * 3; drawPath(ctx, el); break;
        case 'highlighter': ctx.lineWidth = el.style.strokeWidth * 8; ctx.globalAlpha = el.style.opacity * 0.35; drawPath(ctx, el); break;
        case 'text': drawText(ctx, el); break;
        case 'sticky': drawSticky(ctx, el); break;
        case 'image': drawImage(ctx, el, images?.get(el.id)); break;
        case 'frame': drawFrame(ctx, el); break;
    }
    ctx.restore();
}

function drawRect(ctx: CanvasRenderingContext2D, w: number, h: number, r: number, fill: string): void {
    ctx.beginPath();
    const radius = Math.min(r, w / 2, h / 2);
    ctx.roundRect(0, 0, w, h, radius);
    if (fill !== 'transparent') ctx.fill();
    ctx.stroke();
}

function drawEllipse(ctx: CanvasRenderingContext2D, w: number, h: number, fill: string): void {
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    if (fill !== 'transparent') ctx.fill();
    ctx.stroke();
}

function drawPolyStr(ctx: CanvasRenderingContext2D, points: string, fill: string): void {
    const pts = points.split(' ').map(p => p.split(',').map(Number));
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    if (fill !== 'transparent') ctx.fill();
    ctx.stroke();
}

function drawPath(ctx: CanvasRenderingContext2D, el: WhiteboardElement): void {
    if (!('points' in el) || el.points.length === 0) return;
    ctx.beginPath();
    el.points.forEach((p, i) => {
        const lx = p.x - el.x;
        const ly = p.y - el.y;
        i === 0 ? ctx.moveTo(lx, ly) : ctx.lineTo(lx, ly);
    });
    ctx.stroke();
}

function drawArrowHead(ctx: CanvasRenderingContext2D, el: WhiteboardElement, which: 'start' | 'end'): void {
    if (!('points' in el) || el.points.length < 2) return;
    const pts = el.points;
    const [from, to] = which === 'end'
        ? [pts[pts.length - 2], pts[pts.length - 1]]
        : [pts[1], pts[0]];
    const fx = from.x - el.x, fy = from.y - el.y, tx = to.x - el.x, ty = to.y - el.y;
    const angle = Math.atan2(ty - fy, tx - fx);
    const size = Math.max(10, el.style.strokeWidth * 4);
    const spread = Math.PI / 7;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - size * Math.cos(angle - spread), ty - size * Math.sin(angle - spread));
    ctx.lineTo(tx - size * Math.cos(angle + spread), ty - size * Math.sin(angle + spread));
    ctx.closePath();
    ctx.fillStyle = el.style.strokeColor;
    ctx.fill();
}

function drawText(ctx: CanvasRenderingContext2D, el: Extract<WhiteboardElement, { type: 'text' }>): void {
    ctx.setLineDash([]);
    ctx.fillStyle = el.color;
    ctx.textBaseline = 'top';
    // Raster export renders a plain-text approximation; per-run bold/italic/underline formatting
    // from the live rich editor isn't reproduced here.
    ctx.font = `${el.fontWeight} ${el.fontSize}px ${el.fontFamily}`;
    // Canvas2D's textAlign has no 'justify' value — this raster export is already a plain-text
    // approximation (see above), so treat justify as left rather than passing an invalid enum
    // value straight through (which Canvas2D silently ignores, leaking the previous draw's align).
    ctx.textAlign = el.textAlign === 'justify' ? 'left' : el.textAlign;
    const lineHeight = el.fontSize * 1.3;
    const anchorX = el.textAlign === 'center' ? el.width / 2 : el.textAlign === 'right' ? el.width : 0;
    stripHtml(el.text).split('\n').forEach((line, i) => ctx.fillText(line, anchorX, i * lineHeight));
}

function drawImage(
    ctx: CanvasRenderingContext2D,
    el: Extract<WhiteboardElement, { type: 'image' }>,
    img: HTMLImageElement | undefined,
): void {
    if (!img) return;
    ctx.translate(el.width / 2, el.height / 2);
    ctx.scale(el.flipH ? -1 : 1, el.flipV ? -1 : 1);
    ctx.drawImage(img, -el.width / 2, -el.height / 2, el.width, el.height);
}

function drawFrame(ctx: CanvasRenderingContext2D, el: Extract<WhiteboardElement, { type: 'frame' }>): void {
    // Fixed chrome look: frames ignore the element style.
    ctx.strokeStyle = '#928e87';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(0, 0, el.width, el.height);
    ctx.setLineDash([]);
    ctx.fillStyle = '#928e87';
    ctx.font = '12px Inconsolata, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(el.name || el.label, 0, -8);
}

function drawSticky(ctx: CanvasRenderingContext2D, el: Extract<WhiteboardElement, { type: 'sticky' }>): void {
    ctx.setLineDash([]);
    ctx.fillStyle = el.fill;
    ctx.beginPath();
    ctx.roundRect(0, 0, el.width, el.height, 4);
    ctx.fill();
    ctx.fillStyle = '#1a1917';
    ctx.textBaseline = 'top';
    ctx.font = `${el.fontWeight} ${el.fontSize}px ${el.fontFamily || '"Inconsolata", "Courier New", monospace'}`;
    ctx.textAlign = 'left';
    const lineHeight = el.fontSize * 1.35;
    const pad = 12;
    stripHtml(el.text).split('\n').forEach((line, i) => ctx.fillText(line, pad, pad + i * lineHeight, el.width - pad * 2));
}
