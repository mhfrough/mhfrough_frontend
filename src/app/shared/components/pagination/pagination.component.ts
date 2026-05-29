import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Shared pagination bar used across all admin list pages.
 *
 * Usage:
 *   <app-pagination
 *     [currentPage]="currentPage()"
 *     [totalPages]="totalPages()"
 *     [pageNumbers]="pageNumbers"
 *     (pageChange)="currentPage.set($event)"
 *   />
 */
@Component({
    selector: 'app-pagination',
    standalone: true,
    imports: [CommonModule],
    template: `
@if (totalPages() > 1) {
<div class="admin-pagination">
    <button class="admin-pagination-page"
            (click)="pageChange.emit(currentPage() - 1)"
            [disabled]="currentPage() === 1">
        <i class="bi bi-chevron-left"></i>
    </button>

    <div class="admin-pagination-pages">
        @if (pageNumbers()[0] > 1) {
            <button class="admin-pagination-page" (click)="pageChange.emit(1)">1</button>
            @if (pageNumbers()[0] > 2) { <span class="admin-pagination-label">…</span> }
        }

        @for (n of pageNumbers(); track n) {
            <button class="admin-pagination-page"
                    [class.is-active]="currentPage() === n"
                    (click)="pageChange.emit(n)">{{ n }}</button>
        }

        @if (pageNumbers()[pageNumbers().length - 1] < totalPages()) {
            @if (pageNumbers()[pageNumbers().length - 1] < totalPages() - 1) {
                <span class="admin-pagination-label">…</span>
            }
            <button class="admin-pagination-page" (click)="pageChange.emit(totalPages())">{{ totalPages() }}</button>
        }
    </div>

    <button class="admin-pagination-page"
            (click)="pageChange.emit(currentPage() + 1)"
            [disabled]="currentPage() === totalPages()">
        <i class="bi bi-chevron-right"></i>
    </button>

    <span class="admin-pagination-label">{{ currentPage() }} / {{ totalPages() }}</span>
</div>
}
`,
    styles: [':host { display: contents; }'],
})
export class PaginationComponent {
    readonly currentPage = input.required<number>();
    readonly totalPages = input.required<number>();
    readonly pageNumbers = input.required<number[]>();

    readonly pageChange = output<number>();
}
