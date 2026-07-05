import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ViewportService } from '../../core/services/viewport.service';
import { GuidesService } from '../../core/services/guides.service';

interface GuideLine {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** Screen-space overlay drawing smart alignment guides as 1px lines. Untransformed by zoom/pan. */
@Component({
    selector: 'app-guides-overlay',
    standalone: true,
    imports: [],
    templateUrl: './guides-overlay.component.html',
    styleUrl: './guides-overlay.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidesOverlayComponent {
    constructor(private readonly vp: ViewportService, private readonly guidesSvc: GuidesService) {}

    readonly lines = computed<GuideLine[]>(() => {
        const zoom = this.vp.viewport().zoom;
        return this.guidesSvc.guides().map(g => {
            if (g.axis === 'v') {
                const start = this.vp.worldToScreen({ x: g.position, y: g.from });
                return { left: start.x, top: start.y, width: 1, height: (g.to - g.from) * zoom };
            }
            const start = this.vp.worldToScreen({ x: g.from, y: g.position });
            return { left: start.x, top: start.y, width: (g.to - g.from) * zoom, height: 1 };
        });
    });
}
