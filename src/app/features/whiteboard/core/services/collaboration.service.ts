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
 * socket.io namespace.
 *
 * Sync model: element-level deltas (upsert/delete), merged per element with
 * last-writer-wins on `updatedAt`. Concurrent edits to *different* elements
 * both survive; concurrent edits to the same element resolve to the newest.
 * A late joiner converges via a full-scene op from each existing peer, merged
 * with the same rule — a joiner never overwrites the room, and the room never
 * blindly overwrites the joiner.
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
    /** Last state (by element id) this client has broadcast or received — the diff baseline. */
    private shadow = new Map<string, WhiteboardElement>();

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
            this.scheduleDeltaBroadcast(elements);
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
            // Baseline = own scene, so reconnecting doesn't re-broadcast the whole board.
            this.shadow = this.toMap(this.scene.elements());
            this.live.set(true);
            this.connecting.set(false);
        });

        this.socket.on('presence:join', (p: PresenceUser) => {
            this.peers.update(list => (list.some(x => x.socketId === p.socketId) ? list : [...list, p]));
            // Send the newcomer the room state as a merge-safe full-scene op. Redundant when
            // several peers do it, but merging is idempotent and it costs one message each.
            this.emitOp({ kind: 'snapshot', elements: structuredClone(this.scene.elements() as WhiteboardElement[]) });
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
        this.shadow.clear();
        if (this.sceneTimer) {
            clearTimeout(this.sceneTimer);
            this.sceneTimer = null;
        }
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

    // ---- outgoing ----------------------------------------------------------

    private scheduleDeltaBroadcast(elements: readonly WhiteboardElement[]): void {
        if (!this.socket || !this.documentId) return;
        if (this.sceneTimer) clearTimeout(this.sceneTimer);
        this.sceneTimer = setTimeout(() => this.broadcastDiff(), SCENE_THROTTLE);
    }

    private broadcastDiff(): void {
        const current = this.scene.elements();
        const upserts: WhiteboardElement[] = [];
        const currentIds = new Set<string>();

        for (const el of current) {
            currentIds.add(el.id);
            // Reference check: SceneService replaces the object on every mutation. False
            // positives (e.g. after undo restores an equal clone) are harmless — the
            // receiving side's updatedAt merge makes upserts idempotent.
            if (this.shadow.get(el.id) !== el) upserts.push(el);
        }
        const deletes = [...this.shadow.keys()].filter(id => !currentIds.has(id));

        if (upserts.length) this.emitOp({ kind: 'upsert', elements: structuredClone(upserts) });
        if (deletes.length) this.emitOp({ kind: 'delete', ids: deletes });
        this.shadow = this.toMap(current);
    }

    private emitOp(op: SceneOp): void {
        if (!this.socket || !this.documentId) return;
        this.socket.emit('scene:op', { documentId: this.documentId, op });
    }

    // ---- incoming ----------------------------------------------------------

    private applyRemoteOp(op: SceneOp): void {
        this.applyingRemote = true;
        let changed = false;

        if (op.kind === 'delete') {
            const ids = new Set(op.ids);
            const before = this.scene.elements().length;
            this.scene.removeElements(ids);
            for (const id of op.ids) this.shadow.delete(id);
            changed = this.scene.elements().length !== before;
        } else {
            // upsert and snapshot share the same per-element LWW merge; a snapshot just
            // carries the whole scene. Neither ever drops local elements the sender
            // doesn't know about.
            changed = this.mergeElements(op.elements);
        }

        // Keep the undo baseline in step so a local undo can't resurrect stale copies of
        // elements a peer just changed (same behavior the old snapshot sync had).
        if (changed) this.history.reset();
        queueMicrotask(() => (this.applyingRemote = false));
    }

    /** Merge incoming elements: unknown ids append, known ids win only if same-or-newer. */
    private mergeElements(incoming: WhiteboardElement[]): boolean {
        let changed = false;
        const local = this.scene.elements();
        const byId = new Map(local.map(el => [el.id, el] as const));
        const next = [...local];

        for (const remote of incoming) {
            const mine = byId.get(remote.id);
            if (!mine) {
                next.push(remote);
                this.shadow.set(remote.id, remote);
                changed = true;
            } else if (remote.updatedAt >= mine.updatedAt && remote !== mine) {
                next[next.indexOf(mine)] = remote;
                this.shadow.set(remote.id, remote);
                changed = true;
            }
        }

        if (changed) this.scene.replaceAll(next);
        return changed;
    }

    private toMap(elements: readonly WhiteboardElement[]): Map<string, WhiteboardElement> {
        return new Map(elements.map(el => [el.id, el] as const));
    }

    ngOnDestroy(): void {
        this.stop();
    }
}
