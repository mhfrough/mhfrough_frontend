import {
    Component,
    OnInit,
    inject,
    signal,
    PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormArray, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
    InvoicesService,
    CreateInvoicePayload,
} from '../../../../core/services/invoices.service';
import { RteToolbarComponent } from '../../../../shared/components/rte-toolbar/rte-toolbar.component';
import { EditorHelperService } from '../../../../core/services/editor-helper.service';

@Component({
    selector: 'app-admin-invoice-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink, RteToolbarComponent],
    templateUrl: './admin-invoice-form.component.html',
})
export class AdminInvoiceFormComponent implements OnInit {
    private readonly editor = inject(EditorHelperService);
    private readonly fb = inject(FormBuilder);
    private readonly svc = inject(InvoicesService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly platformId = inject(PLATFORM_ID);

    readonly savingPreview = signal(false);
    readonly savingDraft = signal(false);
    readonly loading = signal(false);
    readonly editId = signal<string | null>(null);

    readonly form = this.fb.group({
        clientName: ['', Validators.required],
        clientEmail: ['', [Validators.required, Validators.email]],
        clientAddress: ['', Validators.required],
        clientPhone: [''],
        issueDate: [this.today(), Validators.required],
        dueDate: [this.nextMonth(), Validators.required],
        status: ['draft' as 'draft' | 'sent' | 'paid'],
        taxRate: [0, [Validators.min(0), Validators.max(100)]],
        notes: [''],
        items: this.fb.array([this.newItem()]),
    });

    get items(): FormArray {
        return this.form.get('items') as FormArray;
    }

    get subtotal(): number {
        return this.items.controls.reduce((acc, ctrl) => {
            const qty = Number(ctrl.get('quantity')?.value) || 0;
            const price = Number(ctrl.get('unitPrice')?.value) || 0;
            return acc + qty * price;
        }, 0);
    }

    get taxAmount(): number {
        return (this.subtotal * (Number(this.form.get('taxRate')?.value) || 0)) / 100;
    }

    get grandTotal(): number {
        return this.subtotal + this.taxAmount;
    }

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.editId.set(id);
            this.loading.set(true);
            this.svc.getOne(id).subscribe({
                next: (inv) => {
                    // Clear and rebuild items
                    while (this.items.length) this.items.removeAt(0);
                    const sortedItems = [...(inv.items ?? [])].sort(
                        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
                    );
                    sortedItems.forEach((item) =>
                        this.items.push(
                            this.fb.group({
                                itemName: [item.itemName, Validators.required],
                                subItem: [item.subItem ?? ''],
                                category: [item.category ?? ''],
                                quantity: [Number(item.quantity), [Validators.required, Validators.min(0)]],
                                unitPrice: [Number(item.unitPrice), [Validators.required, Validators.min(0)]],
                            }),
                        ),
                    );
                    this.form.patchValue({
                        clientName: inv.clientName,
                        clientEmail: inv.clientEmail,
                        clientAddress: inv.clientAddress,
                        clientPhone: inv.clientPhone ?? '',
                        issueDate: inv.issueDate,
                        dueDate: inv.dueDate,
                        status: inv.status,
                        taxRate: Number(inv.taxRate),
                        notes: inv.notes ?? '',
                    });
                    this.loading.set(false);
                },
                error: () => this.loading.set(false),
            });
        }
    }

    newItem() {
        return this.fb.group({
            itemName: ['', Validators.required],
            subItem: [''],
            category: [''],
            quantity: [1, [Validators.required, Validators.min(0)]],
            unitPrice: [0, [Validators.required, Validators.min(0)]],
        });
    }

    addItem() {
        this.items.push(this.newItem());
    }

    removeItem(i: number) {
        if (this.items.length > 1) this.items.removeAt(i);
    }

    lineTotal(ctrl: AbstractControl): number {
        const qty = Number(ctrl.get('quantity')?.value) || 0;
        const price = Number(ctrl.get('unitPrice')?.value) || 0;
        return qty * price;
    }

    save(preview = false) {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        if (preview) {
            this.savingPreview.set(true);
        } else {
            this.savingDraft.set(true);
        }
        const v = this.form.getRawValue();
        const payload: CreateInvoicePayload = {
            clientName: v.clientName!,
            clientEmail: v.clientEmail!,
            clientAddress: v.clientAddress!,
            clientPhone: v.clientPhone ?? undefined,
            issueDate: v.issueDate!,
            dueDate: v.dueDate!,
            status: v.status as 'draft' | 'sent' | 'paid',
            taxRate: Number(v.taxRate),
            notes: v.notes ?? undefined,
            items: (v.items ?? []).map((item: any, i: number) => ({
                itemName: item.itemName,
                subItem: item.subItem || undefined,
                category: item.category || undefined,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                sortOrder: i,
            })),
        };

        const id = this.editId();
        const req = id ? this.svc.update(id, payload) : this.svc.create(payload);
        req.subscribe({
            next: (inv) => {
                this.savingPreview.set(false);
                this.savingDraft.set(false);
                if (preview) {
                    this.router.navigate(['/admin/invoices', inv.id]);
                } else {
                    this.router.navigate(['/admin/invoices']);
                }
            },
            error: () => { this.savingPreview.set(false); this.savingDraft.set(false); },
        });
    }

    format(el: HTMLTextAreaElement, open: string, close: string): void {
        this.editor.format(el, open, close);
    }

    insertLink(el: HTMLTextAreaElement): void {
        this.editor.insertLink(el);
    }

    formatCurrency(n: number): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(n);
    }

    private today(): string {
        if (!isPlatformBrowser(this.platformId)) return '';
        return new Date().toISOString().split('T')[0];
    }

    private nextMonth(): string {
        if (!isPlatformBrowser(this.platformId)) return '';
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d.toISOString().split('T')[0];
    }
}
