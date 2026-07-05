import { Injectable, signal, computed } from '@angular/core';
import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, Point, Viewport } from '../models/viewport.model';

/**
 * Owns pan/zoom state for the infinite canvas. All coordinate math (screen <-> world)
 * lives here so drawing/selection code never has to know about the current transform.
 */
@Injectable()
export class ViewportService {
    private readonly state = signal<Viewport>({ x: 0, y: 0, zoom: DEFAULT_ZOOM });

    readonly viewport = this.state.asReadonly();
    readonly zoomPercent = computed(() => Math.round(this.state().zoom * 100));

    readonly gridEnabled = signal(true);
    readonly snapEnabled = signal(true);
    readonly rulersEnabled = signal(true);

    readonly transform = computed(() => {
        const v = this.state();
        return `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
    });

    panBy(dx: number, dy: number): void {
        this.state.update(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }

    panTo(x: number, y: number): void {
        this.state.update(v => ({ ...v, x, y }));
    }

    /** Zoom while keeping `screenPoint` fixed on screen (wheel / pinch anchor). */
    zoomAt(screenPoint: Point, factor: number): void {
        this.state.update(v => {
            const nextZoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
            const ratio = nextZoom / v.zoom;
            const x = screenPoint.x - (screenPoint.x - v.x) * ratio;
            const y = screenPoint.y - (screenPoint.y - v.y) * ratio;
            return { x, y, zoom: nextZoom };
        });
    }

    setZoom(zoom: number, anchor: Point): void {
        const v = this.state();
        this.zoomAt(anchor, clamp(zoom, MIN_ZOOM, MAX_ZOOM) / v.zoom);
    }

    resetView(): void {
        this.state.set({ x: 0, y: 0, zoom: DEFAULT_ZOOM });
    }

    toggleGrid(): void {
        this.gridEnabled.update(v => !v);
    }

    toggleSnap(): void {
        this.snapEnabled.update(v => !v);
    }

    toggleRulers(): void {
        this.rulersEnabled.update(v => !v);
    }

    screenToWorld(point: Point): Point {
        const v = this.state();
        return { x: (point.x - v.x) / v.zoom, y: (point.y - v.y) / v.zoom };
    }

    worldToScreen(point: Point): Point {
        const v = this.state();
        return { x: point.x * v.zoom + v.x, y: point.y * v.zoom + v.y };
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
