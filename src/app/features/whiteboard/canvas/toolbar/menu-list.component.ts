import {
    AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener,
    Input, Output, forwardRef, signal, viewChild,
} from '@angular/core';
import { MenuItem } from '../../core/models/menu.model';
import { clampSubmenuPos } from '../../core/utils/menu-position.util';

/** One menu panel: renders `items`, opens flyout submenus, scrolls + roving-focus keyboard nav. */
@Component({
    selector: 'app-menu-list',
    standalone: true,
    imports: [forwardRef(() => MenuListComponent)],
    templateUrl: './menu-list.component.html',
    styleUrl: './menu-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuListComponent implements AfterViewInit {
    @Input({ required: true }) items: MenuItem[] = [];
    /** Emits when any action anywhere in this menu tree ran, so the root can close everything. */
    @Output() readonly closeAll = new EventEmitter<void>();

    private readonly listRef = viewChild.required<ElementRef<HTMLElement>>('list');

    readonly openIndex = signal<number | null>(null);
    readonly subPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    readonly canScrollUp = signal(false);
    readonly canScrollDown = signal(false);
    readonly focusIndex = signal(0);

    private hoverTimer: ReturnType<typeof setTimeout> | null = null;

    ngAfterViewInit(): void {
        queueMicrotask(() => {
            this.updateScrollState();
            this.focusIndex.set(this.navigableIndices()[0] ?? 0);
            this.focusCurrent();
        });
    }

    isSep(item: MenuItem): item is Extract<MenuItem, { type: 'sep' }> {
        return item.type === 'sep';
    }

    isSubmenu(item: MenuItem): item is Extract<MenuItem, { type: 'submenu' }> {
        return item.type === 'submenu';
    }

    isAction(item: MenuItem): item is Extract<MenuItem, { type: 'action' }> {
        return item.type === 'action';
    }

    trackByIndex(i: number): number {
        return i;
    }

    onScroll(): void {
        this.updateScrollState();
    }

    @HostListener('window:resize')
    onWindowResize(): void {
        queueMicrotask(() => this.updateScrollState());
    }

    private updateScrollState(): void {
        const el = this.listRef().nativeElement;
        this.canScrollUp.set(el.scrollTop > 1);
        this.canScrollDown.set(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    }

    scrollByChunk(dy: number): void {
        this.listRef().nativeElement.scrollBy({ top: dy, behavior: 'smooth' });
    }

    runAction(item: MenuItem): void {
        if (item.type !== 'action' || item.disabled) return;
        item.run();
        this.closeAll.emit();
    }

    openSubmenu(index: number, target: HTMLElement): void {
        const item = this.items[index];
        if (item.type !== 'submenu') return;
        const rect = target.getBoundingClientRect();
        this.subPos.set(clampSubmenuPos(rect, item.items));
        this.openIndex.set(index);
    }

    closeSubmenu(): void {
        this.openIndex.set(null);
    }

    onItemPointerEnter(index: number, e: PointerEvent): void {
        if (this.hoverTimer) clearTimeout(this.hoverTimer);
        const item = this.items[index];
        const target = e.currentTarget as HTMLElement;
        this.hoverTimer = setTimeout(() => {
            if (item.type === 'submenu') this.openSubmenu(index, target);
            else this.closeSubmenu();
        }, 90);
    }

    onItemClick(index: number, e: MouseEvent): void {
        const item = this.items[index];
        if (item.type === 'action') this.runAction(item);
        else if (item.type === 'submenu') this.openSubmenu(index, e.currentTarget as HTMLElement);
    }

    onChildCloseAll(): void {
        this.closeAll.emit();
    }

    /** Cancel the pending "close submenu" hover timer (called while the pointer is over the flyout). */
    cancelPendingClose(): void {
        if (this.hoverTimer) clearTimeout(this.hoverTimer);
    }

    submenuItems(index: number): MenuItem[] {
        const item = this.items[index];
        return item.type === 'submenu' ? item.items : [];
    }

    // --- keyboard: roving focus + submenu open/close ---------------------------
    private navigableIndices(): number[] {
        return this.items.map((it, i) => (it.type === 'sep' ? -1 : i)).filter(i => i >= 0);
    }

    @HostListener('keydown', ['$event'])
    onKeydown(e: KeyboardEvent): void {
        // If a submenu is open, let it handle its own keys first.
        if (this.openIndex() !== null && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) return;

        const nav = this.navigableIndices();
        if (!nav.length) return;
        const pos = nav.indexOf(this.focusIndex());

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            this.focusIndex.set(nav[(pos + 1 + nav.length) % nav.length]);
            this.focusCurrent();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            this.focusIndex.set(nav[(pos - 1 + nav.length) % nav.length]);
            this.focusCurrent();
        } else if (e.key === 'ArrowRight') {
            const item = this.items[this.focusIndex()];
            if (item?.type === 'submenu') {
                e.preventDefault();
                e.stopPropagation();
                const btn = this.listRef().nativeElement.querySelector<HTMLElement>(`[data-idx="${this.focusIndex()}"]`);
                if (btn) this.openSubmenu(this.focusIndex(), btn);
            }
        } else if (e.key === 'ArrowLeft') {
            if (this.openIndex() !== null) {
                e.preventDefault();
                e.stopPropagation();
                this.closeSubmenu();
            }
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            const item = this.items[this.focusIndex()];
            if (item?.type === 'action') this.runAction(item);
            else if (item?.type === 'submenu') {
                const btn = this.listRef().nativeElement.querySelector<HTMLElement>(`[data-idx="${this.focusIndex()}"]`);
                if (btn) this.openSubmenu(this.focusIndex(), btn);
            }
        }
    }

    private focusCurrent(): void {
        const btn = this.listRef().nativeElement.querySelector<HTMLElement>(`[data-idx="${this.focusIndex()}"]`);
        btn?.focus();
        btn?.scrollIntoView({ block: 'nearest' });
    }
}
