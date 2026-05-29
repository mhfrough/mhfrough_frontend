import { signal, computed, Signal } from '@angular/core';

/**
 * Abstract base class for admin list pages.
 * Provides shared pagination + delete-confirmation state so each
 * admin component doesn't have to repeat the same boilerplate.
 *
 * Subclass responsibilities:
 *  - Declare a `readonly totalPages: Signal<number>` computed signal.
 *  - Implement `executeDelete(): void`.
 */
export abstract class AdminListBase {

    // ── Pagination ─────────────────────────────────────────────────────────
    readonly searchQuery = signal('');
    readonly pageSize = signal(25);
    readonly currentPage = signal(1);

    abstract readonly totalPages: Signal<number>;

    get pageNumbers(): number[] {
        const total = this.totalPages();
        const cur = this.currentPage();
        const pages: number[] = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) {
            pages.push(i);
        }
        return pages;
    }

    onSearch(e: Event): void {
        this.searchQuery.set((e.target as HTMLInputElement).value);
        this.currentPage.set(1);
    }

    onPageSizeChange(e: Event): void {
        this.pageSize.set(+(e.target as HTMLSelectElement).value);
        this.currentPage.set(1);
    }

    // ── Delete confirmation ────────────────────────────────────────────────
    readonly deleteTargetId = signal<string | null>(null);

    confirmDelete(id: string): void { this.deleteTargetId.set(id); }
    cancelDelete(): void { this.deleteTargetId.set(null); }

    abstract executeDelete(): void;
}
