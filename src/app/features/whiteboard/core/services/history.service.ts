import { Injectable, signal } from '@angular/core';
import { SceneService } from './scene.service';
import { WhiteboardElement } from '../models/element.model';

const HISTORY_LIMIT = 100;

/**
 * Undo/redo over full scene snapshots. Callers invoke `commit()` at operation
 * boundaries (after a draw, drag, delete, style change...) — never mid-drag.
 */
@Injectable()
export class HistoryService {
    private past: WhiteboardElement[][] = [];
    private future: WhiteboardElement[][] = [];
    private lastSnapshot: WhiteboardElement[] = [];

    readonly canUndo = signal(false);
    readonly canRedo = signal(false);

    constructor(private readonly scene: SceneService) {
        this.lastSnapshot = this.clone(this.scene.elements());
    }

    /** Reset baseline without recording history (e.g. after loading a document). */
    reset(): void {
        this.past = [];
        this.future = [];
        this.lastSnapshot = this.clone(this.scene.elements());
        this.sync();
    }

    commit(): void {
        const current = this.clone(this.scene.elements());
        if (this.isEqual(current, this.lastSnapshot)) return;
        this.past.push(this.lastSnapshot);
        if (this.past.length > HISTORY_LIMIT) this.past.shift();
        this.lastSnapshot = current;
        this.future = [];
        this.sync();
    }

    undo(): void {
        if (!this.past.length) return;
        this.future.push(this.lastSnapshot);
        const prev = this.past.pop()!;
        this.lastSnapshot = prev;
        this.scene.replaceAll(this.clone(prev));
        this.sync();
    }

    redo(): void {
        if (!this.future.length) return;
        this.past.push(this.lastSnapshot);
        const next = this.future.pop()!;
        this.lastSnapshot = next;
        this.scene.replaceAll(this.clone(next));
        this.sync();
    }

    private sync(): void {
        this.canUndo.set(this.past.length > 0);
        this.canRedo.set(this.future.length > 0);
    }

    private clone(elements: readonly WhiteboardElement[]): WhiteboardElement[] {
        return structuredClone(elements as WhiteboardElement[]);
    }

    private isEqual(a: WhiteboardElement[], b: WhiteboardElement[]): boolean {
        return a.length === b.length && JSON.stringify(a) === JSON.stringify(b);
    }
}
