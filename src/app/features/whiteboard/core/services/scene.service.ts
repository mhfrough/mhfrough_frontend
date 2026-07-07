import { Injectable, signal } from '@angular/core';
import { WhiteboardElement } from '../models/element.model';

/** Owns the document model — the ordered list of elements on the board. */
@Injectable()
export class SceneService {
    private readonly elementsState = signal<WhiteboardElement[]>([]);

    readonly elements = this.elementsState.asReadonly();

    addElement(element: WhiteboardElement): void {
        this.elementsState.update(list => [...list, element]);
    }

    updateElement(id: string, patch: Partial<WhiteboardElement>): void {
        this.elementsState.update(list =>
            list.map(el => (el.id === id ? ({ ...el, ...patch, updatedAt: Date.now() } as WhiteboardElement) : el)),
        );
    }

    removeElement(id: string): void {
        this.elementsState.update(list => list.filter(el => el.id !== id));
    }

    removeElements(ids: ReadonlySet<string>): void {
        this.elementsState.update(list => list.filter(el => !ids.has(el.id)));
    }

    getById(id: string): WhiteboardElement | undefined {
        return this.elementsState().find(el => el.id === id);
    }

    reorder(ids: ReadonlySet<string>, direction: 'front' | 'back' | 'forward' | 'backward'): void {
        this.elementsState.update(list => {
            const selected = list.filter(el => ids.has(el.id));
            const rest = list.filter(el => !ids.has(el.id));

            if (direction === 'front') return [...rest, ...selected];
            if (direction === 'back') return [...selected, ...rest];

            const next = [...list];
            const indices = next.map((el, i) => (ids.has(el.id) ? i : -1)).filter(i => i >= 0);
            const step = direction === 'forward' ? 1 : -1;
            const order = step > 0 ? [...indices].reverse() : indices;

            for (const i of order) {
                const j = i + step;
                if (j < 0 || j >= next.length || ids.has(next[j].id)) continue;
                [next[i], next[j]] = [next[j], next[i]];
            }
            return next;
        });
    }

    /** Move `id` to sit directly in front of (`after`) or behind (`before`) `targetId` in z-order. */
    moveElementRelativeTo(id: string, targetId: string, place: 'before' | 'after'): void {
        if (id === targetId) return;
        this.elementsState.update(list => {
            const el = list.find(e => e.id === id);
            if (!el) return list;
            const without = list.filter(e => e.id !== id);
            const targetIdx = without.findIndex(e => e.id === targetId);
            if (targetIdx < 0) return list;
            const insertAt = place === 'after' ? targetIdx + 1 : targetIdx;
            return [...without.slice(0, insertAt), el, ...without.slice(insertAt)];
        });
    }

    replaceAll(elements: WhiteboardElement[]): void {
        this.elementsState.set(elements);
    }

    clear(): void {
        this.elementsState.set([]);
    }
}
