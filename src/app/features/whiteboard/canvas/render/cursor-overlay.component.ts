import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CollaborationService } from '../../core/services/collaboration.service';
import { ViewportService } from '../../core/services/viewport.service';

interface ScreenCursor {
    socketId: string;
    name: string;
    color: string;
    left: number;
    top: number;
}

/** Screen-space overlay of remote collaborators' cursors. */
@Component({
    selector: 'app-cursor-overlay',
    standalone: true,
    imports: [],
    templateUrl: './cursor-overlay.component.html',
    styleUrl: './cursor-overlay.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CursorOverlayComponent {
    constructor(private readonly collab: CollaborationService, private readonly vp: ViewportService) {}

    readonly screenCursors = computed<ScreenCursor[]>(() => {
        this.vp.viewport();
        return Object.values(this.collab.cursors()).map(c => {
            const screen = this.vp.worldToScreen({ x: c.x, y: c.y });
            return { socketId: c.socketId, name: c.name, color: c.color, left: screen.x, top: screen.y };
        });
    });
}
