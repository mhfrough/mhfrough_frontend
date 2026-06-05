import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { TickerService, TickerMessage } from '../../../../../core/services/ticker.service';

@Component({
    selector: 'app-settings-ticker',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule],
    templateUrl: './settings-ticker.component.html',
})
export class SettingsTickerComponent implements OnInit {
    private readonly tickerService = inject(TickerService);

    readonly tickerItems = signal<TickerMessage[]>([]);
    readonly tickerLoading = signal(false);
    readonly tickerSaving = signal(false);
    readonly tickerError = signal<string | null>(null);
    readonly tickerSuccess = signal<string | null>(null);
    readonly tickerDeleteTargetId = signal<string | null>(null);
    readonly tickerDeleting = signal(false);
    readonly tickerShowForm = signal(false);
    readonly tickerEditing = signal<TickerMessage | null>(null);

    readonly tickerPage = signal(1);
    readonly tickerLimit = signal(10);
    readonly tickerTotal = signal(0);
    readonly tickerTotalPages = signal(1);
    readonly tickerSearch = signal('');

    tickerFormMessage = '';
    tickerFormPublished = true;
    tickerFormAutoDeactivateAt = '';

    get tickerPageNumbers(): number[] {
        const total = this.tickerTotalPages();
        const cur = this.tickerPage();
        const pages: number[] = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i);
        return pages;
    }

    ngOnInit() {
        this.loadTickers();
    }

    loadTickers() {
        this.tickerLoading.set(true);
        this.tickerService.getAll(this.tickerPage(), this.tickerLimit(), this.tickerSearch() || undefined).subscribe({
            next: (res) => {
                this.tickerItems.set(res.data);
                this.tickerTotal.set(res.total);
                this.tickerTotalPages.set(res.totalPages);
                this.tickerLoading.set(false);
            },
            error: () => {
                this.tickerLoading.set(false);
                this.tickerError.set('Failed to load ticker messages.');
            },
        });
    }

    onTickerSearch(e: Event) {
        this.tickerSearch.set((e.target as HTMLInputElement).value);
        this.tickerPage.set(1);
        this.loadTickers();
    }

    onTickerPageSizeChange(e: Event) {
        this.tickerLimit.set(+(e.target as HTMLSelectElement).value);
        this.tickerPage.set(1);
        this.loadTickers();
    }

    tickerGoToPage(page: number) {
        this.tickerPage.set(page);
        this.loadTickers();
    }

    openNewTicker() {
        this.tickerEditing.set(null);
        this.tickerFormMessage = '';
        this.tickerFormPublished = true;
        this.tickerFormAutoDeactivateAt = '';
        this.tickerError.set(null);
        this.tickerShowForm.set(true);
    }

    editTicker(item: TickerMessage) {
        this.tickerEditing.set({ ...item });
        this.tickerFormMessage = item.message;
        this.tickerFormPublished = item.isPublished;
        this.tickerFormAutoDeactivateAt = item.autoDeactivateAt
            ? new Date(item.autoDeactivateAt).toISOString().slice(0, 16)
            : '';
        this.tickerError.set(null);
        this.tickerShowForm.set(true);
    }

    cancelTickerForm() {
        this.tickerShowForm.set(false);
        this.tickerEditing.set(null);
    }

    saveTicker(f: NgForm) {
        f.form.markAllAsTouched();
        if (f.invalid || !this.tickerFormMessage.trim()) return;
        this.tickerSaving.set(true);
        this.tickerError.set(null);
        const editing = this.tickerEditing();
        const autoDeactivateAt = this.tickerFormAutoDeactivateAt
            ? new Date(this.tickerFormAutoDeactivateAt).toISOString()
            : null;
        const action$ = editing
            ? this.tickerService.update(editing.id, { message: this.tickerFormMessage.trim(), isPublished: this.tickerFormPublished, autoDeactivateAt: autoDeactivateAt ?? undefined })
            : this.tickerService.create({ message: this.tickerFormMessage.trim(), isPublished: this.tickerFormPublished, autoDeactivateAt });

        action$.subscribe({
            next: () => {
                this.tickerSaving.set(false);
                this.tickerShowForm.set(false);
                this.tickerEditing.set(null);
                this.tickerSuccess.set(editing ? 'Ticker updated.' : 'Ticker created.');
                setTimeout(() => this.tickerSuccess.set(null), 3000);
                this.loadTickers();
            },
            error: (err: any) => {
                this.tickerSaving.set(false);
                this.tickerError.set(err?.error?.message ?? 'Failed to save ticker.');
            },
        });
    }

    toggleTickerPublish(item: TickerMessage) {
        this.tickerService.update(item.id, { isPublished: !item.isPublished }).subscribe({
            next: () => this.loadTickers(),
            error: (err: any) => this.tickerError.set(err?.error?.message ?? 'Failed to update status.'),
        });
    }

    confirmDeleteTicker(id: string) { this.tickerDeleteTargetId.set(id); }
    cancelDeleteTicker() { this.tickerDeleteTargetId.set(null); }

    executeDeleteTicker() {
        const id = this.tickerDeleteTargetId();
        if (!id) return;
        this.tickerDeleting.set(true);
        this.tickerService.remove(id).subscribe({
            next: () => {
                this.tickerDeleteTargetId.set(null);
                this.tickerDeleting.set(false);
                this.tickerSuccess.set('Ticker deleted.');
                setTimeout(() => this.tickerSuccess.set(null), 3000);
                if (this.tickerItems().length === 1 && this.tickerPage() > 1) {
                    this.tickerPage.update(p => p - 1);
                }
                this.loadTickers();
            },
            error: (err: any) => {
                this.tickerDeleting.set(false);
                this.tickerDeleteTargetId.set(null);
                this.tickerError.set(err?.error?.message ?? 'Failed to delete ticker.');
            },
        });
    }
}
