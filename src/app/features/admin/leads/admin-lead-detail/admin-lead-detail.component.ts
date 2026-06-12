import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
    LeadsService,
    Lead,
    LeadStatus,
    CreateLeadPayload,
    UpdateLeadPayload,
} from '../../../../core/services/leads.service';
import { AppointmentStatus } from '../../../../core/services/appointments.service';

const STATUS_LABELS: Record<LeadStatus, string> = {
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
    quoted: 'Quoted',
    won: 'Won',
    lost: 'Lost',
};

const SOURCE_LABELS: Record<string, string> = {
    email: 'Email',
    chat: 'Live Chat',
    appointment: 'Appointment',
    manual: 'Manual',
};

const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    paid: 'Paid',
};

@Component({
    selector: 'app-admin-lead-detail',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './admin-lead-detail.component.html',
})
export class AdminLeadDetailComponent implements OnInit {
    private readonly fb = inject(FormBuilder);
    private readonly svc = inject(LeadsService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    readonly editId = signal<string | null>(null);
    readonly lead = signal<Lead | null>(null);
    readonly loading = signal(false);
    readonly saving = signal(false);

    readonly statuses: LeadStatus[] = ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost'];

    readonly form = this.fb.group({
        name: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        phone: [''],
        website: [''],
        status: ['new' as LeadStatus],
        projectSummary: [''],
        budget: [''],
        notes: [''],
    });

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.editId.set(id);
            this.load(id);
        }
    }

    load(id: string) {
        this.loading.set(true);
        this.svc.getOne(id).subscribe({
            next: (lead) => {
                this.lead.set(lead);
                this.form.patchValue({
                    name: lead.name,
                    email: lead.email,
                    phone: lead.phone ?? '',
                    website: lead.website ?? '',
                    status: lead.status,
                    projectSummary: lead.projectSummary ?? '',
                    budget: lead.budget ?? '',
                    notes: lead.notes ?? '',
                });
                this.loading.set(false);
            },
            error: () => this.loading.set(false),
        });
    }

    save() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        this.saving.set(true);
        const v = this.form.getRawValue();
        const id = this.editId();

        if (id) {
            const payload: UpdateLeadPayload = {
                name: v.name!,
                email: v.email!,
                phone: v.phone || undefined,
                website: v.website || undefined,
                status: v.status as LeadStatus,
                projectSummary: v.projectSummary || undefined,
                budget: v.budget || undefined,
                notes: v.notes || undefined,
            };
            this.svc.update(id, payload).subscribe({
                next: (lead) => {
                    this.lead.set(lead);
                    this.saving.set(false);
                },
                error: () => this.saving.set(false),
            });
        } else {
            const payload: CreateLeadPayload = {
                name: v.name!,
                email: v.email!,
                phone: v.phone || undefined,
                website: v.website || undefined,
                status: v.status as LeadStatus,
                source: 'manual',
                projectSummary: v.projectSummary || undefined,
                budget: v.budget || undefined,
                notes: v.notes || undefined,
            };
            this.svc.create(payload).subscribe({
                next: (lead) => {
                    this.saving.set(false);
                    this.router.navigate(['/admin/leads', lead.id]);
                },
                error: () => this.saving.set(false),
            });
        }
    }

    statusLabel(status: LeadStatus | string): string {
        return STATUS_LABELS[status as LeadStatus] ?? status;
    }

    sourceLabel(source: string): string {
        return SOURCE_LABELS[source] ?? source;
    }

    appointmentStatusLabel(status: string): string {
        return APPOINTMENT_STATUS_LABELS[status as AppointmentStatus] ?? status;
    }

    invoiceStatusLabel(status: string): string {
        return INVOICE_STATUS_LABELS[status] ?? status;
    }

    formatDate(d: string): string {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-US', {
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
