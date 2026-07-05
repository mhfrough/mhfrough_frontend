import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ViewportService } from '../../core/services/viewport.service';
import { SceneService } from '../../core/services/scene.service';
import { SelectionService } from '../../core/services/selection.service';
import { boundingBoxOfElements } from '../../core/utils/hit-test.util';

interface MiniRect {
    x: number;
    y: number;
    width: number;
    height: number;
    selected: boolean;
}

interface MiniMapping {
    bboxX: number;
    bboxY: number;
    scale: number;
    offsetX: number;
    offsetY: number;
}

const MAP_W = 180;
const MAP_H = 120;
/** World-unit padding added around the scene bounding box. */
const SCENE_PAD = 200;
/** Empty-scene fallback world box (centered at 0,0). */
const EMPTY_W = 2000;
const EMPTY_H = 1400;
/** Perf cap: only the first N elements are drawn. */
const MAX_RECTS = 500;
/** Minimum on-map rect size in px so tiny elements stay visible. */
const MIN_RECT = 2;

/** Bottom-right minimap: scene overview, viewport rectangle, click/drag to pan. */
@Component({
    selector: 'app-wb-minimap',
    standalone: true,
    imports: [],
    templateUrl: './minimap.component.html',
    styleUrl: './minimap.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinimapComponent {
    /** Logical canvas surface size in px; used to derive the visible world rect and pan centering. */
    readonly surfaceWidth = input(0);
    readonly surfaceHeight = input(0);

    readonly mapWidth = MAP_W;
    readonly mapHeight = MAP_H;

    readonly open = signal(true);

    private dragging = false;

    constructor(
        private readonly vp: ViewportService,
        private readonly scene: SceneService,
        private readonly selection: SelectionService,
    ) {}

    private readonly surfaceW = computed(() => this.surfaceWidth() || 1200);
    private readonly surfaceH = computed(() => this.surfaceHeight() || 800);

    /** Scene bounding box (world units) with padding; fixed default box when the scene is empty. */
    private readonly sceneBox = computed(() => {
        const els = this.scene.elements();
        if (els.length === 0) {
            return { x: -EMPTY_W / 2, y: -EMPTY_H / 2, width: EMPTY_W, height: EMPTY_H };
        }
        const b = boundingBoxOfElements(els);
        return {
            x: b.x - SCENE_PAD,
            y: b.y - SCENE_PAD,
            width: Math.max(b.width + SCENE_PAD * 2, 1),
            height: Math.max(b.height + SCENE_PAD * 2, 1),
        };
    });

    /** Scale-to-fit world -> minimap px mapping, centered within the 180x120 body. */
    private readonly mapping = computed<MiniMapping>(() => {
        const box = this.sceneBox();
        const scale = Math.min(MAP_W / box.width, MAP_H / box.height);
        return {
            bboxX: box.x,
            bboxY: box.y,
            scale,
            offsetX: (MAP_W - box.width * scale) / 2,
            offsetY: (MAP_H - box.height * scale) / 2,
        };
    });

    readonly elementRects = computed<MiniRect[]>(() => {
        const m = this.mapping();
        const selectedIds = this.selection.selectedIds();
        return this.scene.elements().slice(0, MAX_RECTS).map(el => ({
            x: (el.x - m.bboxX) * m.scale + m.offsetX,
            y: (el.y - m.bboxY) * m.scale + m.offsetY,
            width: Math.max(el.width * m.scale, MIN_RECT),
            height: Math.max(el.height * m.scale, MIN_RECT),
            selected: selectedIds.has(el.id),
        }));
    });

    /** Currently visible world rect projected onto the minimap. */
    readonly viewportRect = computed(() => {
        const v = this.vp.viewport();
        const m = this.mapping();
        const worldX = -v.x / v.zoom;
        const worldY = -v.y / v.zoom;
        return {
            x: (worldX - m.bboxX) * m.scale + m.offsetX,
            y: (worldY - m.bboxY) * m.scale + m.offsetY,
            width: (this.surfaceW() / v.zoom) * m.scale,
            height: (this.surfaceH() / v.zoom) * m.scale,
        };
    });

    toggleOpen(): void {
        this.open.update(v => !v);
    }

    onPointerDown(e: PointerEvent): void {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        this.dragging = true;
        this.panToEvent(e);
    }

    onPointerMove(e: PointerEvent): void {
        if (!this.dragging) return;
        this.panToEvent(e);
    }

    onPointerUp(e: PointerEvent): void {
        this.dragging = false;
        const el = e.currentTarget as HTMLElement;
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    }

    /** Map the minimap point back to world, then pan so that world point centers in the viewport. */
    private panToEvent(e: PointerEvent): void {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const m = this.mapping();
        const worldX = (e.clientX - rect.left - m.offsetX) / m.scale + m.bboxX;
        const worldY = (e.clientY - rect.top - m.offsetY) / m.scale + m.bboxY;
        const zoom = this.vp.viewport().zoom;
        this.vp.panTo(this.surfaceW() / 2 - worldX * zoom, this.surfaceH() / 2 - worldY * zoom);
    }
}
