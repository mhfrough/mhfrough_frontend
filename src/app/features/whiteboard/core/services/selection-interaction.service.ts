import { Injectable, signal } from '@angular/core';
import { Point } from '../models/viewport.model';
import { WhiteboardElement } from '../models/element.model';
import { SceneService } from './scene.service';
import { SelectionService } from './selection.service';
import { HistoryService } from './history.service';
import { rectIntersectsElement } from '../utils/hit-test.util';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type InteractionMode = 'move' | 'resize' | 'rotate' | 'marquee' | null;

interface Snapshot {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    points?: Point[];
}

const MIN_SIZE = 8;

/** Drives pointer drags that mutate the *existing* selection: move, resize, rotate, marquee. */
@Injectable()
export class SelectionInteractionService {
    readonly mode = signal<InteractionMode>(null);
    readonly marqueeRect = signal<{ x: number; y: number; width: number; height: number } | null>(null);

    private origin: Point = { x: 0, y: 0 };
    private snapshots: Snapshot[] = [];
    private handle: ResizeHandle | null = null;
    private rotateCenter: Point = { x: 0, y: 0 };
    private rotateStartAngle = 0;
    private rotateStartRotation = 0;

    constructor(
        private readonly scene: SceneService,
        private readonly selection: SelectionService,
        private readonly history: HistoryService,
    ) {}

    beginMove(point: Point): void {
        this.origin = point;
        this.snapshots = this.selection.selectedElements().map(snapshotOf);
        this.mode.set('move');
    }

    beginResize(handle: ResizeHandle, point: Point): void {
        const el = this.selection.selectedElements()[0];
        if (!el) return;
        this.origin = point;
        this.handle = handle;
        this.snapshots = [snapshotOf(el)];
        this.mode.set('resize');
    }

    beginRotate(point: Point): void {
        const el = this.selection.selectedElements()[0];
        if (!el) return;
        this.rotateCenter = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
        this.rotateStartAngle = Math.atan2(point.y - this.rotateCenter.y, point.x - this.rotateCenter.x);
        this.rotateStartRotation = el.rotation;
        this.snapshots = [snapshotOf(el)];
        this.mode.set('rotate');
    }

    beginMarquee(point: Point): void {
        this.origin = point;
        this.marqueeRect.set({ x: point.x, y: point.y, width: 0, height: 0 });
        this.mode.set('marquee');
    }

    update(point: Point, shiftKey: boolean): void {
        const mode = this.mode();
        if (mode === 'move') this.updateMove(point);
        else if (mode === 'resize') this.updateResize(point, shiftKey);
        else if (mode === 'rotate') this.updateRotate(point, shiftKey);
        else if (mode === 'marquee') this.updateMarquee(point);
    }

    end(additiveSelect: boolean): void {
        const mode = this.mode();
        if (mode === 'marquee') {
            const rect = this.marqueeRect();
            if (rect) {
                const ids = this.scene.elements()
                    .filter(el => !el.locked && !el.hidden && rectIntersectsElement(rect, el))
                    .map(el => el.id);
                this.selection.selectMany(ids, additiveSelect);
            }
        } else if (mode === 'move' || mode === 'resize' || mode === 'rotate') {
            this.history.commit();
        }
        this.mode.set(null);
        this.marqueeRect.set(null);
        this.snapshots = [];
        this.handle = null;
    }

    private updateMove(point: Point): void {
        const dx = point.x - this.origin.x;
        const dy = point.y - this.origin.y;
        for (const snap of this.snapshots) {
            const points = snap.points?.map(p => ({ x: p.x + dx, y: p.y + dy }));
            this.scene.updateElement(snap.id, {
                x: snap.x + dx, y: snap.y + dy, ...(points ? { points } : {}),
            } as Partial<WhiteboardElement>);
        }
    }

    private updateResize(point: Point, shiftKey: boolean): void {
        const snap = this.snapshots[0];
        if (!snap || !this.handle) return;

        let { x, y, width, height } = snap;
        const right = snap.x + snap.width;
        const bottom = snap.y + snap.height;
        const h = this.handle;

        if (h.includes('w')) { x = Math.min(point.x, right - MIN_SIZE); width = right - x; }
        if (h.includes('e')) { width = Math.max(MIN_SIZE, point.x - snap.x); }
        if (h.includes('n')) { y = Math.min(point.y, bottom - MIN_SIZE); height = bottom - y; }
        if (h.includes('s')) { height = Math.max(MIN_SIZE, point.y - snap.y); }

        if (shiftKey && snap.width > 0 && snap.height > 0) {
            const ratio = snap.width / snap.height;
            height = width / ratio;
            if (h.includes('n')) y = bottom - height;
        }

        const scaleX = snap.width > 0 ? width / snap.width : 1;
        const scaleY = snap.height > 0 ? height / snap.height : 1;
        const points = snap.points?.map(p => ({
            x: x + (p.x - snap.x) * scaleX,
            y: y + (p.y - snap.y) * scaleY,
        }));

        this.scene.updateElement(snap.id, { x, y, width, height, ...(points ? { points } : {}) } as Partial<WhiteboardElement>);
    }

    private updateRotate(point: Point, shiftKey: boolean): void {
        const snap = this.snapshots[0];
        if (!snap) return;
        const angle = Math.atan2(point.y - this.rotateCenter.y, point.x - this.rotateCenter.x);
        let deg = this.rotateStartRotation + ((angle - this.rotateStartAngle) * 180) / Math.PI;
        if (shiftKey) deg = Math.round(deg / 15) * 15;
        this.scene.updateElement(snap.id, { rotation: deg } as Partial<WhiteboardElement>);
    }

    private updateMarquee(point: Point): void {
        this.marqueeRect.set({
            x: Math.min(this.origin.x, point.x),
            y: Math.min(this.origin.y, point.y),
            width: Math.abs(point.x - this.origin.x),
            height: Math.abs(point.y - this.origin.y),
        });
    }
}

function snapshotOf(el: WhiteboardElement): Snapshot {
    return {
        id: el.id, x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation,
        points: 'points' in el ? el.points.map(p => ({ ...p })) : undefined,
    };
}
