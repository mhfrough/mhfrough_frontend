import { Injectable, computed, signal } from '@angular/core';
import { SceneService } from './scene.service';
import { WhiteboardElement, generateElementId, isImageElement, isTextLike } from '../models/element.model';
import { ElementStyle } from '../models/style.model';
import { HistoryService } from './history.service';

/** Owns which elements are currently selected, and selection-driven mutations (duplicate, order, align...). */
@Injectable()
export class SelectionService {
    private readonly selectedIdsState = signal<ReadonlySet<string>>(new Set());
    readonly selectedIds = this.selectedIdsState.asReadonly();

    readonly selectedElements = computed<WhiteboardElement[]>(() => {
        const ids = this.selectedIdsState();
        return this.scene.elements().filter(el => ids.has(el.id));
    });

    readonly hasSelection = computed(() => this.selectedIdsState().size > 0);

    constructor(private readonly scene: SceneService, private readonly history: HistoryService) {}

    select(id: string, additive = false): void {
        const groupId = this.scene.getById(id)?.groupId;
        const groupMembers = groupId
            ? this.scene.elements().filter(el => el.groupId === groupId).map(el => el.id)
            : [id];

        if (additive) {
            this.selectedIdsState.update(prev => {
                const next = new Set(prev);
                const alreadyAll = groupMembers.every(m => next.has(m));
                groupMembers.forEach(m => (alreadyAll ? next.delete(m) : next.add(m)));
                return next;
            });
        } else {
            this.selectedIdsState.set(new Set(groupMembers));
        }
    }

    selectMany(ids: string[], additive = false): void {
        this.selectedIdsState.set(additive ? new Set([...this.selectedIdsState(), ...ids]) : new Set(ids));
    }

    selectAll(): void {
        this.selectedIdsState.set(new Set(this.scene.elements().filter(e => !e.locked).map(e => e.id)));
    }

    clear(): void {
        this.selectedIdsState.set(new Set());
    }

    isSelected(id: string): boolean {
        return this.selectedIdsState().has(id);
    }

    deleteSelected(): void {
        this.scene.removeElements(this.selectedIdsState());
        this.clear();
        this.history.commit();
    }

    duplicateSelected(): void {
        const offset = 24;
        const clones = this.selectedElements().map(el => ({
            ...el,
            ...('points' in el ? { points: el.points.map(p => ({ x: p.x + offset, y: p.y + offset })) } : {}),
            id: generateElementId(),
            x: el.x + offset,
            y: el.y + offset,
            groupId: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        } as WhiteboardElement));
        clones.forEach(c => this.scene.addElement(c));
        this.selectMany(clones.map(c => c.id));
        this.history.commit();
    }

    /** Explicit commit for live edits (style/text sliders) once the gesture settles. */
    commitHistory(): void {
        this.history.commit();
    }

    // --- internal element clipboard -----------------------------------------
    private static clipboard: WhiteboardElement[] = [];

    copySelected(): void {
        SelectionService.clipboard = structuredClone(this.selectedElements());
    }

    cutSelected(): void {
        this.copySelected();
        this.deleteSelected();
    }

    pasteClipboard(): void {
        if (!SelectionService.clipboard.length) return;
        const offset = 24;
        const clones = SelectionService.clipboard.map(el => ({
            ...structuredClone(el),
            ...('points' in el ? { points: el.points.map(p => ({ x: p.x + offset, y: p.y + offset })) } : {}),
            id: generateElementId(),
            x: el.x + offset,
            y: el.y + offset,
            groupId: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        } as WhiteboardElement));
        clones.forEach(c => this.scene.addElement(c));
        this.selectMany(clones.map(c => c.id));
        // Re-copy with the new offset so repeated pastes cascade.
        SelectionService.clipboard = structuredClone(clones);
        this.history.commit();
    }

    updateStyle(patch: Partial<ElementStyle>): void {
        this.selectedElements().forEach(el =>
            this.scene.updateElement(el.id, { style: { ...el.style, ...patch } } as Partial<WhiteboardElement>),
        );
    }

    updateTextProps(patch: Partial<Extract<WhiteboardElement, { type: 'text' }>>): void {
        this.selectedElements()
            .filter(isTextLike)
            .forEach(el => this.scene.updateElement(el.id, patch as Partial<WhiteboardElement>));
    }

    /** Flip selected images horizontally or vertically. */
    flipSelected(axis: 'h' | 'v'): void {
        this.selectedElements().filter(isImageElement).forEach(el => {
            const patch = axis === 'h' ? { flipH: !el.flipH } : { flipV: !el.flipV };
            this.scene.updateElement(el.id, patch as Partial<WhiteboardElement>);
        });
        this.history.commit();
    }

    readonly hasImageSelected = computed(() => this.selectedElements().some(isImageElement));

    toggleLockSelected(): void {
        const shouldLock = this.selectedElements().some(el => !el.locked);
        this.selectedElements().forEach(el => this.scene.updateElement(el.id, { locked: shouldLock }));
        if (shouldLock) this.clear();
        this.history.commit();
    }

    groupSelected(): void {
        if (this.selectedElements().length < 2) return;
        const groupId = generateElementId();
        this.selectedElements().forEach(el => this.scene.updateElement(el.id, { groupId }));
        this.history.commit();
    }

    ungroupSelected(): void {
        this.selectedElements().forEach(el => this.scene.updateElement(el.id, { groupId: null }));
        this.history.commit();
    }

    bringToFront(): void {
        this.scene.reorder(this.selectedIdsState(), 'front');
        this.history.commit();
    }

    sendToBack(): void {
        this.scene.reorder(this.selectedIdsState(), 'back');
        this.history.commit();
    }

    bringForward(): void {
        this.scene.reorder(this.selectedIdsState(), 'forward');
        this.history.commit();
    }

    sendBackward(): void {
        this.scene.reorder(this.selectedIdsState(), 'backward');
        this.history.commit();
    }

    nudgeSelected(dx: number, dy: number): void {
        this.selectedElements().forEach(el => {
            const points = 'points' in el ? el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) : undefined;
            this.scene.updateElement(el.id, { x: el.x + dx, y: el.y + dy, ...(points ? { points } : {}) } as Partial<WhiteboardElement>);
        });
        this.history.commit();
    }

    align(edge: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom'): void {
        const els = this.selectedElements();
        if (els.length < 2) return;
        const minX = Math.min(...els.map(e => e.x));
        const maxX = Math.max(...els.map(e => e.x + e.width));
        const minY = Math.min(...els.map(e => e.y));
        const maxY = Math.max(...els.map(e => e.y + e.height));

        els.forEach(el => {
            let x = el.x;
            let y = el.y;
            switch (edge) {
                case 'left': x = minX; break;
                case 'right': x = maxX - el.width; break;
                case 'center-h': x = minX + (maxX - minX - el.width) / 2; break;
                case 'top': y = minY; break;
                case 'bottom': y = maxY - el.height; break;
                case 'center-v': y = minY + (maxY - minY - el.height) / 2; break;
            }
            const dx = x - el.x;
            const dy = y - el.y;
            const points = 'points' in el ? el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) : undefined;
            this.scene.updateElement(el.id, { x, y, ...(points ? { points } : {}) } as Partial<WhiteboardElement>);
        });
        this.history.commit();
    }

    distribute(axis: 'horizontal' | 'vertical'): void {
        const els = [...this.selectedElements()];
        if (els.length < 3) return;

        if (axis === 'horizontal') {
            els.sort((a, b) => a.x - b.x);
            const minX = els[0].x;
            const maxRight = els[els.length - 1].x + els[els.length - 1].width;
            const totalWidth = els.reduce((sum, e) => sum + e.width, 0);
            const gap = (maxRight - minX - totalWidth) / (els.length - 1);
            let cursor = minX;
            els.forEach(el => {
                const dx = cursor - el.x;
                const points = 'points' in el ? el.points.map(p => ({ x: p.x + dx, y: p.y })) : undefined;
                this.scene.updateElement(el.id, { x: cursor, ...(points ? { points } : {}) } as Partial<WhiteboardElement>);
                cursor += el.width + gap;
            });
        } else {
            els.sort((a, b) => a.y - b.y);
            const minY = els[0].y;
            const maxBottom = els[els.length - 1].y + els[els.length - 1].height;
            const totalHeight = els.reduce((sum, e) => sum + e.height, 0);
            const gap = (maxBottom - minY - totalHeight) / (els.length - 1);
            let cursor = minY;
            els.forEach(el => {
                const dy = cursor - el.y;
                const points = 'points' in el ? el.points.map(p => ({ x: p.x, y: p.y + dy })) : undefined;
                this.scene.updateElement(el.id, { y: cursor, ...(points ? { points } : {}) } as Partial<WhiteboardElement>);
                cursor += el.height + gap;
            });
        }
        this.history.commit();
    }
}
