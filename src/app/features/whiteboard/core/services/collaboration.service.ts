import { Injectable, OnDestroy, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Socket } from 'socket.io-client';
import { environment } from '../../../../../environments/environment';
import { SceneService } from './scene.service';
import { HistoryService } from './history.service';
import { WhiteboardElement } from '../models/element.model';
import {
    CollabUser,
    PresenceUser,
    RemoteCursor,
    SceneOp,
    createLocalUser,
} from '../models/collab.model';

const CURSOR_THROTTLE = 45;
const SCENE_THROTTLE = 120;

/**
 * Real-time presence + cursor + scene relay over the backend `/whiteboard`
 * socket.io namespace. Scene sync is last-writer-wins snapshots today; the op
 * envelope is shaped so CRDT/OT deltas can drop in without a protocol change.
 */
@Injectable()
export class CollaborationService implements OnDestroy {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly isBrowser = isPlatformBrowser(this.platformId);

    private socket?: Socket;
    private documentId: string | null = null;
    private applyingRemote = false;
    private cursorTimer: ReturnType<typeof setTimeout> | null = null;
    private sceneTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingCursor: { x: number; y: number } | null = null;

    readonly user: CollabUser = createLocalUser();
    readonly live = signal(false);
    readonly connecting = signal(false);
    readonly peers = signal<PresenceUser[]>([]);
    readonly cursors = signal<Record<string, RemoteCursor>>({});

    constructor(private readonly scene: SceneService, private readonly history: HistoryService) {
        // Broadcast local scene changes to peers (skipped while applying a remote op).
        effect(() => {
            const elements = this.scene.elements();
            if (!this.live() || this.applyingRemote) return;
            this.scheduleSceneBroadcast(elements);
        });
    }

    async start(documentId: string): Promise<void> {
        if (!this.isBrowser || this.live()) return;
        this.connecting.set(true);
        this.documentId = documentId;

        const { io } = await import('socket.io-client');
        const socketUrl = environment.apiUrl.replace('/api/v1', '');
        this.socket = io(`${socketUrl}/whiteboard`, {
            transports: ['websocket', 'polling'],
            withCredentials: true,
        });

        this.socket.on('connect', () => {
            this.socket!.emit(
                'join',
                { documentId, user: this.user },
                (ack: { presence: PresenceUser[] }) => {
                    this.peers.set((ack?.presence ?? []).filter(p => p.id !== this.user.id));
                },
            );
            this.live.set(true);
            this.connecting.set(false);
            // Push our current scene so a late joiner converges.
            this.scheduleSceneBroadcast(this.scene.elements());
        });

        this.socket.on('presence:join', (p: PresenceUser) => {
            this.peers.update(list => (list.some(x => x.socketId === p.socketId) ? list : [...list, p]));
        });

        this.socket.on('presence:leave', (p: { socketId: string }) => {
            this.peers.update(list => list.filter(x => x.socketId !== p.socketId));
            this.cursors.update(map => {
                const next = { ...map };
                delete next[p.socketId];
                return next;
            });
        });

        this.socket.on('cursor', (c: RemoteCursor) => {
            this.cursors.update(map => ({ ...map, [c.socketId]: c }));
        });

        this.socket.on('scene:op', (payload: { op: SceneOp }) => {
            this.applyRemoteOp(payload.op);
        });

        this.socket.on('disconnect', () => this.live.set(false));
    }

    stop(): void {
        if (this.documentId && this.socket) {
            this.socket.emit('leave', { documentId: this.documentId });
        }
        this.socket?.disconnect();
        this.socket = undefined;
        this.documentId = null;
        this.live.set(false);
        this.peers.set([]);
        this.cursors.set({});
    }

    toggle(documentId: string): void {
        this.live() ? this.stop() : void this.start(documentId);
    }

    /** Report the local pointer in world coordinates. Throttled. */
    reportCursor(x: number, y: number): void {
        if (!this.live() || !this.socket) return;
        this.pendingCursor = { x, y };
        if (this.cursorTimer) return;
        this.cursorTimer = setTimeout(() => {
            if (this.pendingCursor && this.documentId) {
                this.socket?.emit('cursor', { documentId: this.documentId, ...this.pendingCursor });
            }
            this.pendingCursor = null;
            this.cursorTimer = null;
        }, CURSOR_THROTTLE);
    }

    private scheduleSceneBroadcast(elements: readonly WhiteboardElement[]): void {
        if (!this.socket || !this.documentId) return;
        if (this.sceneTimer) clearTimeout(this.sceneTimer);
        this.sceneTimer = setTimeout(() => {
            const op: SceneOp = { kind: 'snapshot', elements: structuredClone(elements as WhiteboardElement[]) };
            this.socket?.emit('scene:op', { documentId: this.documentId, op });
        }, SCENE_THROTTLE);
    }

    private applyRemoteOp(op: SceneOp): void {
        if (op.kind !== 'snapshot') return;
        this.applyingRemote = true;
        this.scene.replaceAll(op.elements);
        this.history.reset();
        // Release the guard after the effect flush.
        queueMicrotask(() => (this.applyingRemote = false));
    }

    ngOnDestroy(): void {
        this.stop();
    }
}
