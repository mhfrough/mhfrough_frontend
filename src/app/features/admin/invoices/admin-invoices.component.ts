import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InvoicesService, Invoice } from '../../../core/services/invoices.service';
import { AdminListBase } from '../../../shared/admin-list.base';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
    selector: 'app-admin-invoices',
    standalone: true,
    imports: [CommonModule, RouterLink, PaginationComponent, ConfirmModalComponent],
    templateUrl: './admin-invoices.component.html',
})
export class AdminInvoicesComponent extends AdminListBase implements OnInit {
    private readonly svc = inject(InvoicesService);

    readonly invoices = signal<Invoice[]>([]);
    readonly loading = signal(true);

    readonly paidCount = computed(() =>
        this.invoices().filter((i) => i.status === 'paid').length,
    );
    readonly totalBilled = computed(() =>
        this.invoices().reduce((acc, i) => acc + Number(i.total), 0),
    );
    readonly outstanding = computed(() =>
        this.invoices()
            .filter((i) => i.status !== 'paid')
            .reduce((acc, i) => acc + Number(i.total), 0),
    );

    readonly filteredInvoices = computed(() => {
        const q = this.searchQuery().toLowerCase().trim();
        if (!q) return this.invoices();
        return this.invoices().filter(inv =>
            inv.invoiceNumber?.toLowerCase().includes(q) ||
            (inv as any).clientName?.toLowerCase().includes(q) ||
            (inv as any).clientEmail?.toLowerCase().includes(q)
        );
    });

    readonly pagedInvoices = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.filteredInvoices().slice(start, start + this.pageSize());
    });

    override readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredInvoices().length / this.pageSize()))
    );

    ngOnInit() {
        this.load();
    }

    load() {
        this.loading.set(true);
        this.svc.getAll().subscribe({
            next: (data) => {
                this.invoices.set(data);
                this.loading.set(false);
            },
            error: () => this.loading.set(false),
        });
    }

    override executeDelete(): void {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.svc.remove(id).subscribe(() => this.load());
    }

    statusLabel(status: string): string {
        return { draft: 'Draft', sent: 'Sent', paid: 'Paid' }[status as never] ?? status;
    }

    statusClass(status: string): string {
        return (
            ({
                draft: 'badge bg-secondary',
                sent: 'badge bg-primary',
                paid: 'badge bg-success',
            } as Record<string, string>)[status] ?? 'badge bg-secondary'
        );
    }

    formatDate(d: string): string {
        if (!d) return '—';
        return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }

    formatCurrency(n: number): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(n);
    }
}
