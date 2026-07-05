import { Point } from './viewport.model';
import { ElementStyle } from './style.model';

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
    text: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: 400 | 700;
    italic: boolean;
    underline: boolean;
    textAlign: 'left' | 'center' | 'right';
    color: string;
}

export interface StickyElement extends BaseElement {
    type: 'sticky';
    text: string;
    fontSize: number;
    fill: string;
}

export interface ImageElement extends BaseElement {
    type: 'image';
    /** Image payload as a data-URL (self-contained document, no external fetches). */
    src: string;
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
