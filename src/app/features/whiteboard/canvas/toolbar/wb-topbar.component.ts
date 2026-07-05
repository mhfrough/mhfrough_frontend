import { ChangeDetectionStrategy, Component, ElementRef, HostListener, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HistoryService } from '../../core/services/history.service';
import { PersistenceService } from '../../core/services/persistence.service';
import { ExportService } from '../../core/services/export.service';
import { Orientation, PageSize } from '../../core/utils/pdf-export.util';

type Menu = 'export' | 'versions' | null;

/** Top-left board actions: undo/redo, version history, export/import. */
@Component({
    selector: 'app-wb-topbar',
    standalone: true,
    imports: [DatePipe],
    templateUrl: './wb-topbar.component.html',
    styleUrl: './wb-topbar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WbTopbarComponent {
    private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

    readonly openMenu = signal<Menu>(null);
    readonly versionLabel = signal('');
    readonly pageSize = signal<PageSize>('A4');
    readonly orientation = signal<Orientation>('landscape');
    readonly pageSizes: PageSize[] = ['A4', 'A3', 'Letter'];

    constructor(
        readonly history: HistoryService,
        readonly persistence: PersistenceService,
        private readonly exporter: ExportService,
    ) {}

    toggle(menu: Menu): void {
        this.openMenu.update(m => (m === menu ? null : menu));
    }

    @HostListener('document:click')
    closeMenus(): void {
        this.openMenu.set(null);
    }

    /** Close the open menu and return focus to its trigger button (keyboard-friendly). */
    closeMenu(trigger?: HTMLElement): void {
        this.openMenu.set(null);
        trigger?.focus();
    }

    stop(e: Event): void {
        e.stopPropagation();
    }

    // --- export ------------------------------------------------------------
    exportPng(): void { void this.exporter.exportPng(false); this.openMenu.set(null); }
    exportPngTransparent(): void { void this.exporter.exportPng(true); this.openMenu.set(null); }
    exportJpeg(): void { void this.exporter.exportJpeg(); this.openMenu.set(null); }
    exportSvg(): void { this.exporter.exportSvg(); this.openMenu.set(null); }
    exportJson(): void { this.exporter.exportJson(); this.openMenu.set(null); }
    exportPdf(): void { void this.exporter.exportPdf(this.pageSize(), this.orientation()); this.openMenu.set(null); }
    copyImage(): void { void this.exporter.copyPngToClipboard(); this.openMenu.set(null); }
    print(): void { void this.exporter.print(this.pageSize(), this.orientation()); this.openMenu.set(null); }

    triggerImport(): void {
        this.fileInput().nativeElement.click();
    }

    async onImport(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        try {
            await this.exporter.importJson(file);
        } finally {
            input.value = '';
        }
    }

    // --- versions ----------------------------------------------------------
    saveVersion(): void {
        this.persistence.saveVersion(this.versionLabel());
        this.versionLabel.set('');
    }

    restore(id: string): void {
        this.persistence.restoreVersion(id);
        this.openMenu.set(null);
    }

    deleteVersion(id: string, e: Event): void {
        e.stopPropagation();
        this.persistence.deleteVersion(id);
    }
}
