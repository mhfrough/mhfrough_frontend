import { WhiteboardElement } from './element.model';

export interface CollabUser {
    id: string;
    name: string;
    color: string;
}

export interface PresenceUser extends CollabUser {
    socketId: string;
}

export interface RemoteCursor {
    socketId: string;
    userId: string;
    name: string;
    color: string;
    x: number;
    y: number;
}

/**
 * Op payload relayed over the wire.
 * - `upsert`/`delete`: element-level deltas, merged per element by `updatedAt`
 *   (last-writer-wins per element — two people editing *different* elements never
 *   stomp each other; same-element edits resolve to the newest).
 * - `snapshot`: full scene, merged with the same per-element rule (never a blind
 *   replace) — used to converge a late joiner.
 */
export type SceneOp =
    | { kind: 'snapshot'; elements: WhiteboardElement[] }
    | { kind: 'upsert'; elements: WhiteboardElement[] }
    | { kind: 'delete'; ids: string[] };

const CURSOR_COLORS = ['#6366f1', '#4ade80', '#f59e0b', '#f87171', '#818cf8', '#22c55e', '#d97706'];
const NAMES = ['Falcon', 'Otter', 'Maple', 'Cobalt', 'Ember', 'Willow', 'Onyx', 'Cedar', 'Flint', 'Wren'];

export function createLocalUser(): CollabUser {
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const color = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
    return { id: `u_${Math.random().toString(36).slice(2, 9)}`, name, color };
}

export function initials(name: string): string {
    return name.slice(0, 2).toUpperCase();
}
