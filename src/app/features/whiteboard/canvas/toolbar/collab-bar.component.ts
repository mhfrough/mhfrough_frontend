import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CollaborationService } from '../../core/services/collaboration.service';
import { initials } from '../../core/models/collab.model';

/** Live-collaboration control: presence avatars + go-live toggle + shareable room link. */
@Component({
    selector: 'app-collab-bar',
    standalone: true,
    imports: [],
    templateUrl: './collab-bar.component.html',
    styleUrl: './collab-bar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollabBarComponent {
    private readonly platformId = inject(PLATFORM_ID);
    readonly copied = signal(false);

    constructor(readonly collab: CollaborationService) {}

    readonly avatars = computed(() =>
        this.collab.peers().map(p => ({ socketId: p.socketId, color: p.color, initials: initials(p.name), name: p.name })),
    );

    toggleLive(): void {
        this.collab.toggle(this.roomId());
    }

    async copyLink(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const url = new URL(window.location.href);
        url.searchParams.set('room', this.roomId());
        await navigator.clipboard.writeText(url.toString());
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 1500);
    }

    /** Existing room from the URL, or a freshly-minted id persisted to the URL. */
    private roomId(): string {
        if (!isPlatformBrowser(this.platformId)) return 'local';
        const url = new URL(window.location.href);
        let room = url.searchParams.get('room');
        if (!room) {
            room = `room_${Math.random().toString(36).slice(2, 10)}`;
            url.searchParams.set('room', room);
            window.history.replaceState({}, '', url.toString());
        }
        return room;
    }
}
