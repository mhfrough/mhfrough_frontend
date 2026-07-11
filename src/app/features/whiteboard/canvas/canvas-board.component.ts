import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    HostListener,
    OnDestroy,
    OnInit,
    ViewChild,
    computed,
    effect,
    signal,
} from '@angular/core';
import { NgStyle } from '@angular/common';
import { ViewportService } from '../core/services/viewport.service';
import { SceneService } from '../core/services/scene.service';
import { ToolService } from '../core/services/tool.service';
import { DrawingService } from '../core/services/drawing.service';
import { SelectionService } from '../core/services/selection.service';
import { SelectionInteractionService } from '../core/services/selection-interaction.service';
import { HistoryService } from '../core/services/history.service';
import { PersistenceService } from '../core/services/persistence.service';
import { WhiteboardApiService } from '../core/services/whiteboard-api.service';
import { ExportService } from '../core/services/export.service';
import { CollaborationService } from '../core/services/collaboration.service';
import { ImageService } from '../core/services/image.service';
import { ImageOpsService } from '../core/services/image-ops.service';
import { TextEditingService } from '../core/services/text-editing.service';
import { Point } from '../core/models/viewport.model';
import { isImageElement, isTextLike } from '../core/models/element.model';
import { hitTestTopmost } from '../core/utils/hit-test.util';
import { ImageLayerComponent } from './render/image-layer.component';
import { GuidesService } from '../core/services/guides.service';
import { MinimapComponent } from './minimap/minimap.component';
import { GuidesOverlayComponent } from './render/guides-overlay.component';
import { WbToolbarComponent } from './toolbar/wb-toolbar.component';
import { WbTopbarComponent } from './toolbar/wb-topbar.component';
import { SelectionContextBarComponent } from './toolbar/selection-context-bar.component';
import { CollabBarComponent } from './toolbar/collab-bar.component';
import { StylePanelComponent } from './panels/style-panel.component';
import { LayersPanelComponent } from './panels/layers-panel.component';
import { HelpModalComponent } from './panels/help-modal.component';
import { ShapeLayerComponent } from './render/shape-layer.component';
import { TextLayerComponent } from './render/text-layer.component';
import { SelectionOverlayComponent } from './render/selection-overlay.component';
import { CursorOverlayComponent } from './render/cursor-overlay.component';
import { ImageCropOverlayComponent } from './render/image-crop-overlay.component';
import { ContextMenuComponent } from './toolbar/context-menu.component';
import { TOOL_DEFS, ToolId } from '../core/models/tool.model';

interface ActivePointer {
    x: number;
    y: number;
}

const GRID_BASE = 24;
const RULER_SIZE = 24;

@Component({
    selector: 'app-canvas-board',
    standalone: true,
    imports: [
        NgStyle, WbToolbarComponent, WbTopbarComponent, ShapeLayerComponent, TextLayerComponent,
        SelectionOverlayComponent, SelectionContextBarComponent, StylePanelComponent,
        CollabBarComponent, CursorOverlayComponent, MinimapComponent, GuidesOverlayComponent,
        ImageLayerComponent, ImageCropOverlayComponent, LayersPanelComponent, ContextMenuComponent,
        HelpModalComponent,
    ],
    providers: [
        ViewportService, SceneService, ToolService, DrawingService, SelectionService,
        SelectionInteractionService, HistoryService, PersistenceService, ExportService,
        CollaborationService, GuidesService, ImageService, ImageOpsService, TextEditingService,
        WhiteboardApiService,
    ],
    templateUrl: './canvas-board.component.html',
    styleUrl: './canvas-board.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasBoardComponent implements OnInit, OnDestroy {
    @ViewChild('surface', { static: true }) surfaceRef!: ElementRef<HTMLDivElement>;
    @ViewChild('imageInput', { static: true }) imageInputRef!: ElementRef<HTMLInputElement>;
    @ViewChild(ContextMenuComponent) contextMenu!: ContextMenuComponent;

    /** World point where the next picked image should land (set when the image tool is used). */
    private pendingImagePoint: Point | null = null;

    constructor(
        readonly vp: ViewportService,
        readonly scene: SceneService,
        readonly tools: ToolService,
        private readonly drawing: DrawingService,
        readonly selection: SelectionService,
        private readonly interaction: SelectionInteractionService,
        private readonly history: HistoryService,
        private readonly persistence: PersistenceService,
        private readonly collab: CollaborationService,
        private readonly images: ImageService,
        readonly imageOps: ImageOpsService,
    ) {
        // Announce meaningful state changes to assistive tech via the polite live region.
        effect(() => {
            const def = TOOL_DEFS.find(t => t.id === this.tools.activeTool());
            this.announce.set(`${def ? def.label : 'Selection'} tool active`);
        });
        effect(() => {
            const count = this.selection.selectedElements().length;
            if (count > 0) this.announce.set(`${count} element${count === 1 ? '' : 's'} selected`);
        });
        effect(() => {
            this.announce.set(`Zoom ${this.vp.zoomPercent()} percent`);
        });
    }

    ngOnInit(): void {
        this.persistence.hydrate();
    }

    /** Visually-hidden aria-live announcement text (tool / selection / zoom changes). */
    readonly announce = signal('');

    /** Elements the user can see and interact with (hidden layers are excluded). */
    readonly visibleElements = computed(() => this.scene.elements().filter(el => !el.hidden));
    readonly shapeElements = computed(() => this.visibleElements().filter(el => !isTextLike(el) && !isImageElement(el)));
    readonly textElements = computed(() => this.visibleElements().filter(isTextLike));
    readonly imageElements = computed(() => this.visibleElements().filter(isImageElement));
    readonly draftShape = computed(() => {
        const d = this.drawing.draft();
        return d && !isTextLike(d) ? [d] : [];
    });
    private readonly pointers = new Map<number, ActivePointer>();
    private pinchStartDistance = 0;
    private pinchStartZoom = 1;
    private panPointerId: number | null = null;
    private lastPanPoint: Point | null = null;
    private drawPointerId: number | null = null;
    private selectPointerId: number | null = null;

    /** rAF-coalesced pointermove state: only the latest event is processed per frame. */
    private pendingMove: PointerEvent | null = null;
    private moveFrame: number | null = null;

    readonly spaceHeld = signal(false);
    readonly isPanning = signal(false);
    /** Layers panel is hidden by default; toggled from the view HUD. */
    readonly layersOpen = signal(false);
    readonly helpOpen = signal(false);

    readonly cursorClass = computed(() => {
        if (this.isPanning()) return 'grabbing';
        if (this.spaceHeld()) return 'grab';
        if (this.imageOps.cropping()) return 'default';
        const tool = this.tools.activeTool();
        if (tool === 'text' || tool === 'sticky') return 'text';
        if (tool !== 'selection') return 'crosshair';
        return 'default';
    });

    readonly gridStyle = computed(() => {
        const v = this.vp.viewport();
        if (!this.vp.gridEnabled()) return {};
        const size = GRID_BASE * v.zoom;
        return {
            'background-size': `${size}px ${size}px`,
            'background-position': `${v.x}px ${v.y}px`,
        };
    });

    private readonly resizeTick = signal(0);
    readonly rulerTicksX = computed(() => {
        this.resizeTick();
        return this.buildTicks('x');
    });
    readonly rulerTicksY = computed(() => {
        this.resizeTick();
        return this.buildTicks('y');
    });
    readonly rulerSize = RULER_SIZE;

    @HostListener('window:resize')
    onResize(): void {
        this.resizeTick.update(v => v + 1);
    }

    @HostListener('window:keydown', ['$event'])
    onKeyDown(e: KeyboardEvent): void {
        if (e.code === 'Space' && !this.spaceHeld()) {
            this.spaceHeld.set(true);
        }
        if (e.code === 'Digit0' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.vp.resetView();
        }
        const target = e.target as HTMLElement;

        // Escape typed into an unrelated <input>/<textarea> elsewhere in the UI (e.g. the
        // layers-panel rename box) shouldn't blow away the canvas selection — that field
        // already has its own local Escape handler to cancel just itself. Whiteboard text/
        // sticky editing uses a contenteditable div, not INPUT/TEXTAREA, so it's unaffected
        // by this guard and Escape still exits it below, per the original intent.
        if (e.code === 'Escape' && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
            if (this.imageOps.cropping()) {
                this.imageOps.cancelCrop();
                return;
            }
            // Exit any active text edit first — otherwise editingId stays set after Escape and
            // every later click/drag on that box gets swallowed by the "still editing" check.
            const focused = document.activeElement as HTMLElement | null;
            if (focused?.isContentEditable) focused.blur();
            this.drawing.cancel();
            this.tools.setTool('selection');
            this.selection.clear();
        }

        if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.shiftKey ? this.history.redo() : this.history.undo();
            return;
        }
        if (e.code === 'KeyY' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.history.redo();
            return;
        }

        if ((e.code === 'Delete' || e.code === 'Backspace') && this.selection.hasSelection()) {
            e.preventDefault();
            this.selection.deleteSelected();
        }
        if (e.code === 'KeyD' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.selection.duplicateSelected();
        }
        if (e.code === 'KeyC' && (e.ctrlKey || e.metaKey) && this.selection.hasSelection()) {
            e.preventDefault();
            this.selection.copySelected();
        }
        if (e.code === 'KeyX' && (e.ctrlKey || e.metaKey) && this.selection.hasSelection()) {
            e.preventDefault();
            this.selection.cutSelected();
        }
        if (e.code === 'KeyV' && (e.ctrlKey || e.metaKey)) {
            // Element paste; image paste from the OS clipboard arrives via the window paste event.
            this.selection.pasteClipboard();
        }
        if (e.code === 'KeyG' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.selection.groupSelected();
        }
        if (e.code === 'KeyA' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.selection.selectAll();
        }
        if (e.key.startsWith('Arrow') && this.selection.hasSelection()) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
            const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
            this.selection.nudgeSelected(dx, dy);
            return;
        }

        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            const tool = this.shortcutTool(e.key, e.shiftKey);
            if (tool === 'image') {
                // Image isn't a persistent tool mode — open the picker immediately (see openImagePicker).
                e.preventDefault();
                this.openImagePicker();
                return;
            }
            if (tool) {
                e.preventDefault();
                this.selection.clear();
                this.tools.setTool(tool);
            }
        }
    }

    private shortcutTool(key: string, shift: boolean): ToolId | null {
        const combo = `${shift ? 'Shift+' : ''}${key.toUpperCase()}`;
        const def = TOOL_DEFS.find(t => t.shortcut === combo || (!shift && t.shortcut === key.toUpperCase()));
        return def ? def.id : null;
    }

    @HostListener('window:keyup', ['$event'])
    onKeyUp(e: KeyboardEvent): void {
        if (e.code === 'Space') {
            this.spaceHeld.set(false);
        }
    }

    onWheel(e: WheelEvent): void {
        e.preventDefault();
        const rect = this.surfaceRef.nativeElement.getBoundingClientRect();
        const anchor: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        if (e.ctrlKey || e.metaKey) {
            const factor = Math.exp(-e.deltaY * 0.01);
            this.vp.zoomAt(anchor, factor);
        } else if (e.shiftKey) {
            this.vp.panBy(-e.deltaY, -e.deltaX);
        } else {
            this.vp.panBy(-e.deltaX, -e.deltaY);
        }
    }

    onPointerDown(e: PointerEvent): void {
        // The crop overlay owns all input while active.
        if (this.imageOps.cropping()) return;
        const rect = this.surfaceRef.nativeElement.getBoundingClientRect();
        this.pointers.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top });
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        if (this.interaction.mode() === 'resize' || this.interaction.mode() === 'rotate') {
            return;
        }

        if (this.pointers.size === 2) {
            this.panPointerId = null;
            const pts = [...this.pointers.values()];
            this.pinchStartDistance = distance(pts[0], pts[1]);
            this.pinchStartZoom = this.vp.viewport().zoom;
            return;
        }

        const canPan = this.spaceHeld() || e.button === 1;
        if (canPan && this.pointers.size === 1) {
            this.panPointerId = e.pointerId;
            this.lastPanPoint = { x: e.clientX, y: e.clientY };
            this.isPanning.set(true);
            return;
        }

        if (canPan || e.button !== 0 || this.pointers.size !== 1) return;
        const local = this.pointers.get(e.pointerId)!;
        const world = this.snap(this.vp.screenToWorld(local));

        if (this.tools.activeTool() !== 'selection') {
            this.drawPointerId = e.pointerId;
            this.drawing.begin(this.tools.activeTool(), world);
            return;
        }

        this.selectPointerId = e.pointerId;
        const hit = hitTestTopmost(world, this.visibleElements(), this.vp.viewport().zoom);
        if (hit) {
            if (!e.shiftKey && !this.selection.isSelected(hit.id)) {
                this.selection.select(hit.id, false);
            } else {
                this.selection.select(hit.id, e.shiftKey);
            }
            this.interaction.beginMove(world);
        } else {
            if (!e.shiftKey) this.selection.clear();
            this.interaction.beginMarquee(world);
        }
    }

    onPointerMove(e: PointerEvent): void {
        // Coalesce rapid pointermove events: keep the latest and process once per frame.
        this.pendingMove = e;
        if (this.moveFrame === null) {
            this.moveFrame = requestAnimationFrame(() => {
                this.moveFrame = null;
                const pending = this.pendingMove;
                this.pendingMove = null;
                if (pending) this.processPointerMove(pending);
            });
        }
    }

    /** Flush any pending coalesced move immediately (called before pointerup/destroy). */
    private flushPendingMove(): void {
        if (this.moveFrame !== null) {
            cancelAnimationFrame(this.moveFrame);
            this.moveFrame = null;
        }
        const pending = this.pendingMove;
        this.pendingMove = null;
        if (pending) this.processPointerMove(pending);
    }

    private processPointerMove(e: PointerEvent): void {
        const rect = this.surfaceRef.nativeElement.getBoundingClientRect();
        if (this.collab.live()) {
            const world = this.vp.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            this.collab.reportCursor(world.x, world.y);
        }
        if (!this.pointers.has(e.pointerId)) return;
        this.pointers.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top });

        if (this.pointers.size === 2) {
            const pts = [...this.pointers.values()];
            const dist = distance(pts[0], pts[1]);
            const mid: Point = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
            if (this.pinchStartDistance > 0) {
                const targetZoom = this.pinchStartZoom * (dist / this.pinchStartDistance);
                this.vp.setZoom(targetZoom, mid);
            }
            return;
        }

        if (this.panPointerId === e.pointerId && this.lastPanPoint) {
            const dx = e.clientX - this.lastPanPoint.x;
            const dy = e.clientY - this.lastPanPoint.y;
            this.vp.panBy(dx, dy);
            this.lastPanPoint = { x: e.clientX, y: e.clientY };
            return;
        }

        if (this.drawPointerId === e.pointerId) {
            const local = this.pointers.get(e.pointerId)!;
            this.drawing.update(this.snap(this.vp.screenToWorld(local)), e.shiftKey);
            return;
        }

        if (this.selectPointerId === e.pointerId || this.interaction.mode() !== null) {
            const local = this.pointers.get(e.pointerId)!;
            this.interaction.update(this.snap(this.vp.screenToWorld(local)), e.shiftKey);
        }
    }

    /** Surface pixel size for the minimap viewport rect; refreshed on window resize. */
    readonly surfaceSize = computed(() => {
        this.resizeTick();
        const el = this.surfaceRef?.nativeElement;
        return { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 };
    });

    /**
     * Opens the native file picker immediately (synchronously, within the originating click/keydown
     * handler) so the browser's user-activation requirement for showing a file dialog is preserved —
     * deferring this through an async effect or a second canvas click was the cause of the picker
     * sometimes not opening, or only opening after an extra click.
     */
    openImagePicker(): void {
        this.pendingImagePoint = this.centerWorldPoint();
        this.imageInputRef.nativeElement.click();
    }

    async onImageFilePicked(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const files = Array.from(input.files ?? []);
        const point = this.pendingImagePoint ?? this.centerWorldPoint();
        this.pendingImagePoint = null;
        input.value = '';
        // Cascade multiple images so they don't land stacked exactly on top of each other.
        const OFFSET = 28;
        for (let i = 0; i < files.length; i++) {
            await this.images.addImageFromFile(files[i], { x: point.x + i * OFFSET, y: point.y + i * OFFSET });
        }
    }

    onDragOver(e: DragEvent): void {
        e.preventDefault();
    }

    async onDrop(e: DragEvent): Promise<void> {
        e.preventDefault();
        if (!e.dataTransfer) return;
        const rect = this.surfaceRef.nativeElement.getBoundingClientRect();
        const world = this.vp.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        await this.images.addImagesFromDataTransfer(e.dataTransfer, world);
    }

    @HostListener('window:paste', ['$event'])
    async onPaste(e: ClipboardEvent): Promise<void> {
        const target = e.target as HTMLElement;
        if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        if (!e.clipboardData) return;
        await this.images.addImagesFromDataTransfer(e.clipboardData, this.centerWorldPoint());
    }

    private centerWorldPoint(): Point {
        const rect = this.surfaceRef.nativeElement.getBoundingClientRect();
        return this.vp.screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
    }

    /** Rounds a world point to the grid when snapping is enabled. */
    private snap(point: Point): Point {
        if (!this.vp.snapEnabled()) return point;
        return {
            x: Math.round(point.x / GRID_BASE) * GRID_BASE,
            y: Math.round(point.y / GRID_BASE) * GRID_BASE,
        };
    }

    onPointerUp(e: PointerEvent): void {
        // Ensure the final move before release is applied (don't drop it to the dropped frame).
        this.flushPendingMove();
        this.pointers.delete(e.pointerId);
        if (this.panPointerId === e.pointerId) {
            this.panPointerId = null;
            this.lastPanPoint = null;
            this.isPanning.set(false);
        }
        if (this.drawPointerId === e.pointerId) {
            this.drawPointerId = null;
            this.drawing.commit();
        }
        if (this.selectPointerId === e.pointerId) {
            this.selectPointerId = null;
        }
        if (this.interaction.mode() !== null) {
            this.interaction.end(e.shiftKey);
        }
        if (this.pointers.size < 2) {
            this.pinchStartDistance = 0;
        }
    }

    onContextMenu(e: MouseEvent): void {
        e.preventDefault();
        const rect = this.surfaceRef.nativeElement.getBoundingClientRect();
        const world = this.vp.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        const hit = hitTestTopmost(world, this.visibleElements(), this.vp.viewport().zoom);
        if (hit) {
            if (!this.selection.isSelected(hit.id)) this.selection.select(hit.id, false);
        } else {
            this.selection.clear();
        }
        this.contextMenu.openAt(e.clientX, e.clientY);
    }

    zoomIn(): void {
        const rect = this.surfaceRef.nativeElement.getBoundingClientRect();
        this.vp.zoomAt({ x: rect.width / 2, y: rect.height / 2 }, 1.2);
    }

    zoomOut(): void {
        const rect = this.surfaceRef.nativeElement.getBoundingClientRect();
        this.vp.zoomAt({ x: rect.width / 2, y: rect.height / 2 }, 1 / 1.2);
    }

    private buildTicks(axis: 'x' | 'y'): { pos: number; label: string; major: boolean }[] {
        const v = this.vp.viewport();
        const rect = this.surfaceRef?.nativeElement?.getBoundingClientRect();
        if (!rect) return [];
        const size = axis === 'x' ? rect.width : rect.height;
        const offset = axis === 'x' ? v.x : v.y;
        const step = pickStep(v.zoom);
        const worldStart = -offset / v.zoom;
        const worldEnd = (size - offset) / v.zoom;
        const firstTick = Math.floor(worldStart / step) * step;

        const ticks: { pos: number; label: string; major: boolean }[] = [];
        for (let w = firstTick; w <= worldEnd; w += step) {
            const pos = w * v.zoom + offset;
            ticks.push({ pos, label: String(Math.round(w)), major: Math.round(w / step) % 5 === 0 });
        }
        return ticks;
    }

    ngOnDestroy(): void {
        if (this.moveFrame !== null) {
            cancelAnimationFrame(this.moveFrame);
            this.moveFrame = null;
        }
        this.pendingMove = null;
        this.pointers.clear();
    }
}

function distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function pickStep(zoom: number): number {
    const raw = 80 / zoom;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const residual = raw / magnitude;
    const niceResidual = residual >= 5 ? 5 : residual >= 2 ? 2 : 1;
    return niceResidual * magnitude;
}
