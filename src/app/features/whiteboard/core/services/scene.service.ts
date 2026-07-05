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

    replaceAll(elements: WhiteboardElement[]): void {
        this.elementsState.set(elements);
    }

    clear(): void {
        this.elementsState.set([]);
    }
}
