import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { WhiteboardElement } from '../../core/models/element.model';
import { ViewportService } from '../../core/services/viewport.service';
import { ResizeHandle, SelectionInteractionService } from '../../core/services/selection-interaction.service';
import { boundingBoxOfElements } from '../../core/utils/hit-test.util';

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Screen-space overlay: selection bounding box(es), resize handles and the rotate handle. Untransformed by zoom/pan. */
@Component({
    selector: 'app-selection-overlay',
    standalone: true,
    imports: [],
    templateUrl: './selection-overlay.component.html',
    styleUrl: './selection-overlay.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionOverlayComponent {
    /** Mirror of the `elements` input as a signal so the computeds below track its changes under OnPush. */
    private readonly elementsSig = signal<WhiteboardElement[]>([]);
    @Input({ required: true })
    set elements(value: WhiteboardElement[]) {
        this.elementsSig.set(value);
    }
    get elements(): WhiteboardElement[] {
        return this.elementsSig();
    }

    readonly handles = HANDLES;

    constructor(readonly vp: ViewportService, readonly interaction: SelectionInteractionService) {}

    readonly single = computed(() => {
        const els = this.elementsSig();
        return els.length === 1 ? els[0] : null;
    });

    readonly singleBox = computed(() => {
        const el = this.single();
        if (!el) return null;
        const zoom = this.vp.viewport().zoom;
        const topLeft = this.vp.worldToScreen({ x: el.x, y: el.y });
        return { left: topLeft.x, top: topLeft.y, width: el.width * zoom, height: el.height * zoom, rotation: el.rotation };
    });

    readonly groupBox = computed(() => {
        const els = this.elementsSig();
        if (els.length < 2) return null;
        const bbox = boundingBoxOfElements(els);
        const zoom = this.vp.viewport().zoom;
        const topLeft = this.vp.worldToScreen({ x: bbox.x, y: bbox.y });
        return { left: topLeft.x, top: topLeft.y, width: bbox.width * zoom, height: bbox.height * zoom };
    });

    readonly marqueeBox = computed(() => {
        const rect = this.interaction.marqueeRect();
        if (!rect) return null;
        const topLeft = this.vp.worldToScreen({ x: rect.x, y: rect.y });
        const zoom = this.vp.viewport().zoom;
        return { left: topLeft.x, top: topLeft.y, width: rect.width * zoom, height: rect.height * zoom };
    });

    handlePointerDown(e: PointerEvent, handle: ResizeHandle): void {
        const el = this.single();
        if (!el) return;
        this.interaction.beginResize(handle, this.vp.screenToWorld(this.eventLocal(e)));
    }

    rotatePointerDown(e: PointerEvent): void {
        this.interaction.beginRotate(this.vp.screenToWorld(this.eventLocal(e)));
    }

    private eventLocal(e: PointerEvent): { x: number; y: number } {
        const host = (e.currentTarget as HTMLElement).closest('.wb-surface') as HTMLElement | null;
        const rect = host?.getBoundingClientRect();
        if (!rect) return { x: e.clientX, y: e.clientY };
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
}
