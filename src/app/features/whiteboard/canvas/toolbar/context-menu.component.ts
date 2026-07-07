import { ChangeDetectionStrategy, Component, HostListener, computed, signal } from '@angular/core';
import { SelectionService } from '../../core/services/selection.service';
import { ExportService } from '../../core/services/export.service';
import { MenuItem } from '../../core/models/menu.model';
import { clampRootMenuPos } from '../../core/utils/menu-position.util';
import { MenuListComponent } from './menu-list.component';

/** Right-click context menu: actions relevant to whatever is currently selected (or empty canvas). */
@Component({
    selector: 'app-context-menu',
    standalone: true,
    imports: [MenuListComponent],
    templateUrl: './context-menu.component.html',
    styleUrl: './context-menu.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextMenuComponent {
    readonly open = signal(false);
    readonly pos = signal<{ x: number; y: number }>({ x: 0, y: 0 });

    readonly items = computed<MenuItem[]>(() => this.buildItems());

    constructor(private readonly selection: SelectionService, private readonly exporter: ExportService) {}

    openAt(x: number, y: number): void {
        this.pos.set(clampRootMenuPos(x, y, this.buildItems()));
        this.open.set(true);
    }

    close(): void {
        this.open.set(false);
    }

    @HostListener('document:pointerdown', ['$event'])
    onDocPointerDown(e: PointerEvent): void {
        if (!this.open()) return;
        const menu = document.querySelector('.wb-ctxmenu-root');
        if (menu && !menu.contains(e.target as Node)) this.close();
    }

    @HostListener('document:keydown.escape')
    onEsc(): void {
        this.close();
    }

    private buildItems(): MenuItem[] {
        const sel = this.selection;
        if (!sel.hasSelection()) {
            return [
                { type: 'action', label: 'Paste', icon: 'bi-clipboard-check', shortcut: 'Ctrl+V', run: () => sel.pasteClipboard() },
                { type: 'action', label: 'Select all', icon: 'bi-bounding-box-circles', shortcut: 'Ctrl+A', run: () => sel.selectAll() },
            ];
        }

        const els = sel.selectedElements();
        const multi = els.length > 1;
        const isImage = sel.hasImageSelected();
        const isGrouped = els.some(el => el.groupId);

        const items: MenuItem[] = [
            { type: 'action', label: 'Copy', icon: 'bi-clipboard', shortcut: 'Ctrl+C', run: () => sel.copySelected() },
            { type: 'action', label: 'Cut', icon: 'bi-scissors', shortcut: 'Ctrl+X', run: () => sel.cutSelected() },
            { type: 'action', label: 'Duplicate', icon: 'bi-copy', shortcut: 'Ctrl+D', run: () => sel.duplicateSelected() },
            { type: 'sep' },
        ];

        if (isImage) {
            items.push(
                { type: 'action', label: 'Flip horizontal', icon: 'bi-symmetry-vertical', run: () => sel.flipSelected('h') },
                { type: 'action', label: 'Flip vertical', icon: 'bi-symmetry-horizontal', run: () => sel.flipSelected('v') },
                { type: 'sep' },
            );
        }

        const exportItems: MenuItem[] = [
            { type: 'action', label: 'PNG (transparent)', icon: 'bi-filetype-png', run: () => this.exporter.exportPng(true, true) },
            { type: 'action', label: 'SVG', icon: 'bi-filetype-svg', run: () => this.exporter.exportSvg(true) },
            { type: 'action', label: 'Object (.json)', icon: 'bi-box', run: () => this.exporter.exportJson(true) },
        ];
        if (multi) {
            exportItems.push(
                { type: 'sep' },
                { type: 'action', label: 'Each as PNG', icon: 'bi-collection', run: () => void this.exporter.exportSelectionPngEach() },
                { type: 'action', label: 'Each as SVG', icon: 'bi-collection', run: () => this.exporter.exportSelectionSvgEach() },
            );
        }
        items.push({ type: 'submenu', label: 'Export', icon: 'bi-download', items: exportItems });

        items.push({
            type: 'submenu', label: 'Arrange', icon: 'bi-layers', items: [
                { type: 'action', label: 'Bring to front', icon: 'bi-front', run: () => sel.bringToFront() },
                { type: 'action', label: 'Bring forward', icon: 'bi-square-half', run: () => sel.bringForward() },
                { type: 'action', label: 'Send backward', icon: 'bi-square', run: () => sel.sendBackward() },
                { type: 'action', label: 'Send to back', icon: 'bi-back', run: () => sel.sendToBack() },
            ],
        });

        if (multi) {
            items.push({
                type: 'submenu', label: 'Align & distribute', icon: 'bi-align-center', items: [
                    { type: 'action', label: 'Align left', icon: 'bi-align-start', run: () => sel.align('left') },
                    { type: 'action', label: 'Align center', icon: 'bi-align-center', run: () => sel.align('center-h') },
                    { type: 'action', label: 'Align right', icon: 'bi-align-end', run: () => sel.align('right') },
                    { type: 'action', label: 'Align top', icon: 'bi-align-top', run: () => sel.align('top') },
                    { type: 'action', label: 'Align middle', icon: 'bi-align-middle', run: () => sel.align('center-v') },
                    { type: 'action', label: 'Align bottom', icon: 'bi-align-bottom', run: () => sel.align('bottom') },
                    { type: 'sep' },
                    { type: 'action', label: 'Distribute horizontally', icon: 'bi-distribute-horizontal', run: () => sel.distribute('horizontal') },
                    { type: 'action', label: 'Distribute vertically', icon: 'bi-distribute-vertical', run: () => sel.distribute('vertical') },
                ],
            });
            items.push(
                isGrouped
                    ? { type: 'action', label: 'Ungroup', icon: 'bi-x-square', run: () => sel.ungroupSelected() }
                    : { type: 'action', label: 'Group', icon: 'bi-bounding-box', shortcut: 'Ctrl+G', run: () => sel.groupSelected() },
            );
        }

        items.push(
            { type: 'sep' },
            { type: 'action', label: 'Lock / Unlock', icon: 'bi-lock', run: () => sel.toggleLockSelected() },
            { type: 'action', label: 'Delete', icon: 'bi-trash3', shortcut: 'Del', danger: true, run: () => sel.deleteSelected() },
        );

        return items;
    }
}
