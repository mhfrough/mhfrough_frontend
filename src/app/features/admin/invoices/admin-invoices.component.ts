import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InvoicesService, Invoice } from '../../../core/services/invoices.service';

@Component({
    selector: 'app-admin-invoices',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './admin-invoices.component.html',
})
export class AdminInvoicesComponent implements OnInit {
    private readonly svc = inject(InvoicesService);

    readonly invoices = signal<Invoice[]>([]);
    readonly loading = signal(true);
    readonly deleteTargetId = signal<string | null>(null);

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

    confirmDelete(id: string) {
        this.deleteTargetId.set(id);
    }

    cancelDelete() {
        this.deleteTargetId.set(null);
    }

    executeDelete() {
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
