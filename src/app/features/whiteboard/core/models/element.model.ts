import { Point } from './viewport.model';
import { ElementStyle } from './style.model';
import { stripHtml } from '../utils/text.util';

export type ShapeType = 'rectangle' | 'ellipse' | 'diamond' | 'triangle' | 'star';
export type PathType = 'line' | 'arrow' | 'double-arrow' | 'pencil' | 'brush' | 'highlighter';
export type ElementType = ShapeType | 'polygon' | PathType | 'text' | 'sticky' | 'image' | 'frame';

interface BaseElement {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    style: ElementStyle;
    locked: boolean;
    groupId: string | null;
    createdAt: number;
    updatedAt: number;
    /** Optional user-given layer name (falls back to a type-derived label in the UI). */
    name?: string;
    /** When true, the element is hidden from the canvas (still listed in the layers panel). */
    hidden?: boolean;
}

export interface ShapeElement extends BaseElement {
    type: ShapeType;
}

export interface PolygonElement extends BaseElement {
    type: 'polygon';
    sides: number;
}

export interface PathElement extends BaseElement {
    type: PathType;
    points: Point[];
}

export interface TextElement extends BaseElement {
    type: 'text';
    /** Rich content as sanitized inline HTML (bold/italic/underline/strikethrough runs), not plain text. */
    text: string;
    fontFamily: string;
    fontSize: number;
    /** CSS font-weight (100-900), whole-box like fontFamily/fontSize — not the per-selection Bold toggle. */
    fontWeight: number;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    color: string;
    /** 'auto' grows the box to fit content (default); 'fixed' keeps the manually-set size and clips overflow. */
    sizing: 'auto' | 'fixed';
}

export interface StickyElement extends BaseElement {
    type: 'sticky';
    /** Rich content as sanitized inline HTML — see TextElement.text. */
    text: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    fill: string;
}

export interface ImageElement extends BaseElement {
    type: 'image';
    /** Image payload as a data-URL (self-contained document, no external fetches). */
    src: string;
    /** Source before any crop / mask / boolean edit, kept so those edits can be reset. */
    originalSrc?: string;
    naturalWidth: number;
    naturalHeight: number;
    flipH: boolean;
    flipV: boolean;
}

export interface FrameElement extends BaseElement {
    type: 'frame';
    label: string;
}

export type WhiteboardElement =
    | ShapeElement
    | PolygonElement
    | PathElement
    | TextElement
    | StickyElement
    | ImageElement
    | FrameElement;

export const PATH_TYPES: ReadonlySet<ElementType> = new Set<ElementType>([
    'line', 'arrow', 'double-arrow', 'pencil', 'brush', 'highlighter',
]);

export function isPathElement(el: WhiteboardElement): el is PathElement {
    return PATH_TYPES.has(el.type);
}

export function isTextLike(el: WhiteboardElement): el is TextElement | StickyElement {
    return el.type === 'text' || el.type === 'sticky';
}

export function isImageElement(el: WhiteboardElement): el is ImageElement {
    return el.type === 'image';
}

export function isFrameElement(el: WhiteboardElement): el is FrameElement {
    return el.type === 'frame';
}

export function generateElementId(): string {
    return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const TYPE_LABELS: Record<ElementType, string> = {
    rectangle: 'Rectangle', ellipse: 'Ellipse', diamond: 'Diamond', triangle: 'Triangle',
    star: 'Star', polygon: 'Polygon', line: 'Line', arrow: 'Arrow', 'double-arrow': 'Double arrow',
    pencil: 'Pencil', brush: 'Brush', highlighter: 'Highlighter', text: 'Text', sticky: 'Sticky',
    image: 'Image', frame: 'Frame',
};

const TYPE_ICONS: Record<ElementType, string> = {
    rectangle: 'bi-square', ellipse: 'bi-circle', diamond: 'bi-suit-diamond', triangle: 'bi-triangle',
    star: 'bi-star', polygon: 'bi-hexagon', line: 'bi-slash-lg', arrow: 'bi-arrow-up-right',
    'double-arrow': 'bi-arrow-left-right', pencil: 'bi-pencil', brush: 'bi-brush', highlighter: 'bi-highlighter',
    text: 'bi-fonts', sticky: 'bi-sticky', image: 'bi-image', frame: 'bi-aspect-ratio',
};

/** Human label for an element: its custom name, else a type-derived one (with sticky/text preview). */
export function elementDisplayName(el: WhiteboardElement): string {
    if (el.name) return el.name;
    if ((el.type === 'text' || el.type === 'sticky') && el.text.trim()) {
        const plain = stripHtml(el.text).replace(/\s+/g, ' ').trim();
        if (plain) return plain.slice(0, 24);
    }
    return TYPE_LABELS[el.type];
}

export function elementIcon(el: WhiteboardElement): string {
    return TYPE_ICONS[el.type];
}
