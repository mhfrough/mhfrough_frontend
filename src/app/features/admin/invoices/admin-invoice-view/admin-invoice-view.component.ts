import {
    Component,
    OnInit,
    inject,
    signal,
    PLATFORM_ID,
    ViewEncapsulation,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { InvoicesService, Invoice } from '../../../../core/services/invoices.service';

@Component({
    selector: 'app-admin-invoice-view',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './admin-invoice-view.component.html',
    encapsulation: ViewEncapsulation.None,
    styles: [`
    @media print {
      .admin-wrap, .admin-sidebar, .admin-mobile-bar, .admin-toasts { display: none !important; }
      .admin-content { margin: 0 !important; padding: 0 !important; }
      .inv-view-actions, .inv-view-nav { display: none !important; }
      .inv-doc {
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        max-width: 100% !important;
      }
      body, html { background: #fff !important; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @page { size: A4; margin: 15mm; }
  `],
})
export class AdminInvoiceViewComponent implements OnInit {
    private readonly svc = inject(InvoicesService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly platformId = inject(PLATFORM_ID);

    readonly invoice = signal<Invoice | null>(null);
    readonly loading = signal(true);

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) {
            this.router.navigate(['/admin/invoices']);
            return;
        }
        this.svc.getOne(id).subscribe({
            next: (inv) => {
                this.invoice.set(inv);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
                this.router.navigate(['/admin/invoices']);
            },
        });
    }

    print() {
        if (isPlatformBrowser(this.platformId)) {
            window.print();
        }
    }

    updateStatus(status: 'draft' | 'sent' | 'paid') {
        const inv = this.invoice();
        if (!inv) return;
        const payload = {
            clientName: inv.clientName,
            clientEmail: inv.clientEmail,
            clientAddress: inv.clientAddress,
            clientPhone: inv.clientPhone,
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            items: inv.items.map((it, i) => ({
                itemName: it.itemName,
                subItem: it.subItem,
                category: it.category,
                quantity: Number(it.quantity),
                unitPrice: Number(it.unitPrice),
                sortOrder: i,
            })),
            notes: inv.notes,
            status,
            taxRate: Number(inv.taxRate),
        };
        this.svc.update(inv.id, payload).subscribe((updated) =>
            this.invoice.set(updated),
        );
    }

    formatDate(d: string): string {
        if (!d) return '—';
        return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    formatCurrency(n: number | string): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(Number(n));
    }

    lineTotal(qty: number | string, price: number | string): number {
        return Number(qty) * Number(price);
    }

    get sortedItems() {
        return [...(this.invoice()?.items ?? [])].sort(
            (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
        );
    }
}
