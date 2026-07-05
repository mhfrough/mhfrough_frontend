import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { WhiteboardElement } from '../../core/models/element.model';
import { Viewport } from '../../core/models/viewport.model';
import { ElementStyle, dashArrayFor } from '../../core/models/style.model';
import {
    arrowHeadPoints,
    diamondPoints,
    pathD,
    polygonPoints,
    starPoints,
    trianglePoints,
} from '../../core/utils/shape-geometry.util';

/** Upper bound on cached geometry strings before the cache is pragmatically cleared. */
const GEOMETRY_CACHE_CAP = 512;

/** Renders every non-text element (shapes, polygons and paths) as an absolutely-positioned SVG layer. */
@Component({
    selector: 'app-shape-layer',
    standalone: true,
    imports: [],
    templateUrl: './shape-layer.component.html',
    styleUrl: './shape-layer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShapeLayerComponent {
    @Input({ required: true }) elements: WhiteboardElement[] = [];
    @Input({ required: true }) viewport!: Viewport;

    /**
     * Per-element geometry cache. Keyed by element id + the inputs that affect the
     * generated string, so an unchanged shape reuses its path/points across change
     * detection cycles instead of recomputing every frame.
     */
    private readonly geometryCache = new Map<string, string>();

    get groupTransform(): string {
        const v = this.viewport;
        return `translate(${v.x},${v.y}) scale(${v.zoom})`;
    }

    dash(style: ElementStyle): string | null {
        return dashArrayFor(style);
    }

    private memo(key: string, compute: () => string): string {
        const hit = this.geometryCache.get(key);
        if (hit !== undefined) return hit;
        if (this.geometryCache.size >= GEOMETRY_CACHE_CAP) this.geometryCache.clear();
        const value = compute();
        this.geometryCache.set(key, value);
        return value;
    }

    diamond(el: WhiteboardElement): string {
        return this.memo(`${el.id}:diamond:${el.width}:${el.height}`, () => diamondPoints(el.width, el.height));
    }

    triangle(el: WhiteboardElement): string {
        return this.memo(`${el.id}:triangle:${el.width}:${el.height}`, () => trianglePoints(el.width, el.height));
    }

    star(el: WhiteboardElement): string {
        return this.memo(`${el.id}:star:${el.width}:${el.height}`, () => starPoints(el.width, el.height));
    }

    polygon(el: WhiteboardElement, sides: number): string {
        return this.memo(
            `${el.id}:polygon:${el.width}:${el.height}:${sides}`,
            () => polygonPoints(el.width, el.height, sides),
        );
    }

    localPath(el: WhiteboardElement): string {
        if (!('points' in el)) return '';
        return this.memo(
            `${el.id}:path:${el.x}:${el.y}:${el.points.length}`,
            () => pathD(el.points.map(p => ({ x: p.x - el.x, y: p.y - el.y }))),
        );
    }

    arrowHeadStart(el: WhiteboardElement): string {
        if (!('points' in el) || el.points.length < 2) return '';
        return this.memo(`${el.id}:arrowStart:${el.x}:${el.y}:${el.points.length}`, () => {
            const pts = (el as WhiteboardElement & { points: { x: number; y: number }[] }).points;
            const [a, b] = pts;
            return arrowHeadPoints({ x: b.x - el.x, y: b.y - el.y }, { x: a.x - el.x, y: a.y - el.y });
        });
    }

    arrowHeadEnd(el: WhiteboardElement): string {
        if (!('points' in el) || el.points.length < 2) return '';
        return this.memo(`${el.id}:arrowEnd:${el.x}:${el.y}:${el.points.length}`, () => {
            const pts = (el as WhiteboardElement & { points: { x: number; y: number }[] }).points;
            const a = pts[pts.length - 2];
            const b = pts[pts.length - 1];
            return arrowHeadPoints({ x: a.x - el.x, y: a.y - el.y }, { x: b.x - el.x, y: b.y - el.y });
        });
    }
}
