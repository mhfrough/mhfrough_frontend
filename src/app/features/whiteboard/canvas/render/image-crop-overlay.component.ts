import { ChangeDetectionStrategy, Component, ElementRef, computed } from '@angular/core';
import { ViewportService } from '../../core/services/viewport.service';
import { ImageOpsService, Rect } from '../../core/services/image-ops.service';
import { Point } from '../../core/models/viewport.model';

type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type DragKind = 'move' | CropHandle;

const HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const RATIOS: { label: string; value: number | null }[] = [
    { label: 'Free', value: null },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
    { label: '7:4', value: 7 / 4 },
];

/**
 * Screen-space interactive crop UI shown while an image is in crop mode. Darkens
 * everything outside the crop frame and lets the frame be moved / resized; Apply
 * bakes the crop, Cancel discards it.
 */
@Component({
    selector: 'app-image-crop-overlay',
    standalone: true,
    imports: [],
    templateUrl: './image-crop-overlay.component.html',
    styleUrl: './image-crop-overlay.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageCropOverlayComponent {
    readonly handles = HANDLES;
    readonly ratios = RATIOS;

    private drag: { kind: DragKind; startRect: Rect } | null = null;

    constructor(
        readonly ops: ImageOpsService,
        readonly vp: ViewportService,
        private readonly host: ElementRef<HTMLElement>,
    ) {}

    /** Screen-space rect of the crop frame. */
    readonly cropBox = computed(() => {
        const rect = this.ops.cropRect();
        if (!rect) return null;
        const zoom = this.vp.viewport().zoom;
        const tl = this.vp.worldToScreen({ x: rect.x, y: rect.y });
        return { left: tl.x, top: tl.y, width: rect.width * zoom, height: rect.height * zoom };
    });

    readonly activeRatio = computed(() => this.ops.cropRatio());

    onPointerDown(e: PointerEvent, kind: DragKind): void {
        e.preventDefault();
        e.stopPropagation();
        const rect = this.ops.cropRect();
        if (!rect) return;
        this.drag = { kind, startRect: { ...rect } };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

    onPointerMove(e: PointerEvent): void {
        if (!this.drag) return;
        const p = this.toWorld(e);
        const s = this.drag.startRect;
        if (this.drag.kind === 'move') {
            this.ops.setCropRect({ ...s, x: p.x - s.width / 2, y: p.y - s.height / 2 });
            return;
        }
        const h = this.drag.kind;
        const right = s.x + s.width;
        const bottom = s.y + s.height;
        let { x, y } = s;
        let width = s.width;
        let height = s.height;
        if (h.includes('w')) { x = p.x; width = right - p.x; }
        if (h.includes('e')) { width = p.x - s.x; }
        if (h.includes('n')) { y = p.y; height = bottom - p.y; }
        if (h.includes('s')) { height = p.y - s.y; }
        this.ops.setCropRect({ x, y, width, height });
    }

    onPointerUp(): void {
        this.drag = null;
    }

    selectRatio(ratio: number | null): void {
        this.ops.setCropRatio(ratio);
    }

    apply(): void {
        void this.ops.applyCrop();
    }

    cancel(): void {
        this.ops.cancelCrop();
    }

    private toWorld(e: PointerEvent): Point {
        const surface = this.host.nativeElement.closest('.wb-surface') as HTMLElement | null;
        const rect = surface?.getBoundingClientRect();
        const local = rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: e.clientX, y: e.clientY };
        return this.vp.screenToWorld(local);
    }
}
