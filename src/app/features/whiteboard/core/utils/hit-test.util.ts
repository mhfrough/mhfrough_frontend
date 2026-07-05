import { Point } from '../models/viewport.model';
import { WhiteboardElement } from '../models/element.model';

const HIT_PAD = 6;

function toLocal(point: Point, el: WhiteboardElement): Point {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    if (!el.rotation) return { x: point.x - el.x, y: point.y - el.y };
    const rad = (-el.rotation * Math.PI) / 180;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    return { x: rx + el.width / 2, y: ry + el.height / 2 };
}

/** Bounding-box hit test in the element's own (unrotated) local space, with a small pad for thin strokes. */
export function hitTestElement(point: Point, el: WhiteboardElement, zoom: number): boolean {
    if (el.locked) return false;
    const local = toLocal(point, el);
    const pad = HIT_PAD / zoom;
    return local.x >= -pad && local.x <= el.width + pad && local.y >= -pad && local.y <= el.height + pad;
}

export function hitTestTopmost(point: Point, elements: readonly WhiteboardElement[], zoom: number): WhiteboardElement | null {
    for (let i = elements.length - 1; i >= 0; i--) {
        if (hitTestElement(point, elements[i], zoom)) return elements[i];
    }
    return null;
}

export function rectIntersectsElement(rect: { x: number; y: number; width: number; height: number }, el: WhiteboardElement): boolean {
    return !(
        el.x + el.width < rect.x ||
        el.x > rect.x + rect.width ||
        el.y + el.height < rect.y ||
        el.y > rect.y + rect.height
    );
}

export function boundingBoxOfElements(elements: readonly WhiteboardElement[]): { x: number; y: number; width: number; height: number } {
    if (elements.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const minX = Math.min(...elements.map(e => e.x));
    const minY = Math.min(...elements.map(e => e.y));
    const maxX = Math.max(...elements.map(e => e.x + e.width));
    const maxY = Math.max(...elements.map(e => e.y + e.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
