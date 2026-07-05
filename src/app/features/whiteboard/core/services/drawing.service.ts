import { Injectable, signal } from '@angular/core';
import { Point } from '../models/viewport.model';
import {
    FrameElement,
    PathType,
    PolygonElement,
    ShapeElement,
    ShapeType,
    StickyElement,
    TextElement,
    WhiteboardElement,
    generateElementId,
    isFrameElement,
} from '../models/element.model';
import { ToolId } from '../models/tool.model';
import { SceneService } from './scene.service';
import { ToolService } from './tool.service';
import { HistoryService } from './history.service';
import { STICKY_DEFAULT_FILL } from '../models/style.model';
import { THEME_FONT } from '../models/palette.model';

const SHAPE_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>(['rectangle', 'rounded-rectangle', 'ellipse', 'circle', 'diamond', 'triangle', 'star']);
const PATH_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>(['line', 'arrow', 'double-arrow', 'pencil', 'brush', 'highlighter']);

const TOOL_TO_SHAPE_TYPE: Partial<Record<ToolId, ShapeType>> = {
    rectangle: 'rectangle',
    'rounded-rectangle': 'rectangle',
    ellipse: 'ellipse',
    circle: 'ellipse',
    diamond: 'diamond',
    triangle: 'triangle',
    star: 'star',
};

const TOOL_TO_PATH_TYPE: Partial<Record<ToolId, PathType>> = {
    line: 'line',
    arrow: 'arrow',
    'double-arrow': 'double-arrow',
    pencil: 'pencil',
    brush: 'brush',
    highlighter: 'highlighter',
};

const FREEHAND_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>(['pencil', 'brush', 'highlighter']);
const MIN_FREEHAND_SPACING = 3;

/** Drives the pointer-down -> drag -> pointer-up state machine for creating new elements. */
@Injectable()
export class DrawingService {
    readonly draft = signal<WhiteboardElement | null>(null);
    private origin: Point = { x: 0, y: 0 };
    private activeToolId: ToolId = 'selection';

    constructor(
        private readonly scene: SceneService,
        private readonly tools: ToolService,
        private readonly history: HistoryService,
    ) {}

    begin(tool: ToolId, point: Point): void {
        this.origin = point;
        this.activeToolId = tool;
        const now = Date.now();
        const style = this.tools.style();

        if (tool === 'text') {
            const el: TextElement = {
                id: generateElementId(), type: 'text', x: point.x, y: point.y,
                width: 220, height: 40, rotation: 0, locked: false, groupId: null, createdAt: now, updatedAt: now,
                style, text: '', fontFamily: THEME_FONT, fontSize: 20, fontWeight: 400,
                italic: false, underline: false, textAlign: 'left', color: style.strokeColor,
            };
            this.scene.addElement(el);
            this.history.commit();
            this.tools.finishDraw();
            return;
        }

        if (tool === 'sticky') {
            const el: StickyElement = {
                id: generateElementId(), type: 'sticky', x: point.x - 100, y: point.y - 100,
                width: 200, height: 200, rotation: 0, locked: false, groupId: null, createdAt: now, updatedAt: now,
                style, text: '', fontSize: 16, fill: STICKY_DEFAULT_FILL,
            };
            this.scene.addElement(el);
            this.history.commit();
            this.tools.finishDraw();
            return;
        }

        if (tool === 'image') {
            // The board opens a file picker for this tool; nothing is drafted here.
            this.tools.finishDraw();
            return;
        }

        if (tool === 'frame') {
            const frameCount = this.scene.elements().filter(isFrameElement).length;
            const el: FrameElement = {
                id: generateElementId(), type: 'frame', x: point.x, y: point.y, width: 0, height: 0,
                rotation: 0, locked: false, groupId: null, createdAt: now, updatedAt: now, style,
                label: `Frame ${frameCount + 1}`,
            };
            this.draft.set(el);
            return;
        }

        if (tool === 'polygon') {
            const el: PolygonElement = {
                id: generateElementId(), type: 'polygon', x: point.x, y: point.y, width: 0, height: 0,
                rotation: 0, locked: false, groupId: null, createdAt: now, updatedAt: now, style, sides: 6,
            };
            this.draft.set(el);
            return;
        }

        if (SHAPE_TOOLS.has(tool)) {
            const shapeType = TOOL_TO_SHAPE_TYPE[tool]!;
            const el: ShapeElement = {
                id: generateElementId(), type: shapeType, x: point.x, y: point.y, width: 0, height: 0,
                rotation: 0, locked: false, groupId: null, createdAt: now, updatedAt: now,
                style: tool === 'rounded-rectangle' ? { ...style, cornerRadius: 16 } : style,
            };
            this.draft.set(el);
            return;
        }

        if (PATH_TOOLS.has(tool)) {
            const pathType = TOOL_TO_PATH_TYPE[tool]!;
            const el = {
                id: generateElementId(), type: pathType, x: point.x, y: point.y, width: 0, height: 0,
                rotation: 0, locked: false, groupId: null, createdAt: now, updatedAt: now, style,
                points: [point, point],
            } as WhiteboardElement;
            this.draft.set(el);
        }
    }

    update(point: Point, shiftKey: boolean): void {
        const el = this.draft();
        if (!el) return;

        if ('points' in el) {
            const isFreehand = FREEHAND_TOOLS.has(this.activeToolId);
            let points = el.points;

            if (isFreehand) {
                const last = points[points.length - 1];
                if (distance(last, point) >= MIN_FREEHAND_SPACING) {
                    points = [...points, point];
                }
            } else {
                const next = shiftKey ? snapToAngle(points[0], point) : point;
                points = [points[0], next];
            }

            const bbox = boundingBoxOf(points);
            this.draft.set({ ...el, points, ...bbox } as WhiteboardElement);
            return;
        }

        let w = point.x - this.origin.x;
        let h = point.y - this.origin.y;
        if (shiftKey || this.activeToolId === 'circle') {
            const size = Math.max(Math.abs(w), Math.abs(h));
            w = Math.sign(w || 1) * size;
            h = Math.sign(h || 1) * size;
        }
        const x = w < 0 ? this.origin.x + w : this.origin.x;
        const y = h < 0 ? this.origin.y + h : this.origin.y;
        this.draft.set({ ...el, x, y, width: Math.abs(w), height: Math.abs(h) } as WhiteboardElement);
    }

    commit(): void {
        const el = this.draft();
        this.draft.set(null);
        if (!el) return;

        const hasSize = el.width > 1 || el.height > 1 || ('points' in el && el.points.length > 1);
        if (!hasSize) return;

        this.scene.addElement(el);
        this.history.commit();
        this.tools.finishDraw();
    }

    cancel(): void {
        this.draft.set(null);
    }
}

function distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function boundingBoxOf(points: Point[]): { x: number; y: number; width: number; height: number } {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function snapToAngle(origin: Point, point: Point): Point {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12);
    return { x: origin.x + Math.cos(angle) * dist, y: origin.y + Math.sin(angle) * dist };
}
