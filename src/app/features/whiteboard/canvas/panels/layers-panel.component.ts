import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Output, computed, signal } from '@angular/core';
import { SceneService } from '../../core/services/scene.service';
import { SelectionService } from '../../core/services/selection.service';
import { WhiteboardElement, elementDisplayName, elementIcon } from '../../core/models/element.model';

/** Figma-style layers list: reorder, rename, hide and lock every element on the board. */
@Component({
    selector: 'app-layers-panel',
    standalone: true,
    imports: [],
    templateUrl: './layers-panel.component.html',
    styleUrl: './layers-panel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayersPanelComponent {
    @Output() readonly closePanel = new EventEmitter<void>();

    /** Front-most element first (scene order is back-to-front). */
    readonly rows = computed(() => [...this.scene.elements()].reverse());
    readonly editingId = signal<string | null>(null);

    /** Drag-reorder state. */
    readonly dragId = signal<string | null>(null);
    readonly dropTarget = signal<{ id: string; place: 'above' | 'below' } | null>(null);

    constructor(
        private readonly scene: SceneService,
        private readonly selection: SelectionService,
        private readonly host: ElementRef<HTMLElement>,
    ) {}

    name(el: WhiteboardElement): string { return elementDisplayName(el); }
    icon(el: WhiteboardElement): string { return elementIcon(el); }
    isSelected(id: string): boolean { return this.selection.isSelected(id); }

    select(id: string, e: MouseEvent): void {
        this.selection.select(id, e.shiftKey);
    }

    moveUp(id: string, e: Event): void {
        e.stopPropagation();
        this.scene.reorder(new Set([id]), 'forward');
        this.selection.commitHistory();
    }

    moveDown(id: string, e: Event): void {
        e.stopPropagation();
        this.scene.reorder(new Set([id]), 'backward');
        this.selection.commitHistory();
    }

    toggleHidden(el: WhiteboardElement, e: Event): void {
        e.stopPropagation();
        this.selection.setElementHidden(el.id, !el.hidden);
    }

    toggleLock(el: WhiteboardElement, e: Event): void {
        e.stopPropagation();
        this.selection.setElementLocked(el.id, !el.locked);
    }

    startRename(el: WhiteboardElement, e: Event): void {
        e.stopPropagation();
        this.editingId.set(el.id);
        queueMicrotask(() => {
            const input = this.host.nativeElement.querySelector<HTMLInputElement>(`[data-rename="${el.id}"]`);
            input?.focus();
            input?.select();
        });
    }

    commitRename(id: string, e: Event): void {
        const value = (e.target as HTMLInputElement).value;
        this.selection.renameElement(id, value);
        this.editingId.set(null);
    }

    // --- drag & drop reordering ------------------------------------------------
    onDragStart(id: string, e: DragEvent): void {
        this.dragId.set(id);
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', id);
        }
    }

    onDragOver(id: string, e: DragEvent): void {
        const drag = this.dragId();
        if (!drag || drag === id) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const place = e.clientY - rect.top < rect.height / 2 ? 'above' : 'below';
        this.dropTarget.set({ id, place });
    }

    onDrop(id: string, e: DragEvent): void {
        e.preventDefault();
        const drag = this.dragId();
        const target = this.dropTarget();
        if (drag && drag !== id && target) {
            // The list is front-first, so "above" a row means a higher z-index → insert after it.
            this.scene.moveElementRelativeTo(drag, id, target.place === 'above' ? 'after' : 'before');
            this.selection.commitHistory();
        }
        this.resetDrag();
    }

    onDragEnd(): void {
        this.resetDrag();
    }

    private resetDrag(): void {
        this.dragId.set(null);
        this.dropTarget.set(null);
    }

    close(): void {
        this.closePanel.emit();
    }
}
