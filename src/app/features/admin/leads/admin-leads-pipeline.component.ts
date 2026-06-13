import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
    CdkDragDrop, DragDropModule, transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { LeadsService, Lead, LeadStatus } from '../../../core/services/leads.service';
import { RealtimeService } from '../../../core/services/realtime.service';

interface PipelineColumn {
    status: LeadStatus;
    label: string;
    accent: string;
    leads: Lead[];
}

// Warm, muted pipeline accents that sit on the sepia theme (was bootstrap hex).
const COLUMN_DEFS: { status: LeadStatus; label: string; accent: string }[] = [
    { status: 'new', label: 'New', accent: '#928e87' },
    { status: 'contacted', label: 'Contacted', accent: '#9c8f7a' },
    { status: 'qualified', label: 'Qualified', accent: '#c2a25e' },
    { status: 'quoted', label: 'Quoted', accent: '#d98c4a' },
    { status: 'won', label: 'Won', accent: '#6bbf8a' },
    { status: 'lost', label: 'Lost', accent: '#c46a6a' },
];

const SOURCE_LABELS: Record<string, string> = {
    email: 'Email', chat: 'Live Chat', appointment: 'Appointment', manual: 'Manual',
};

@Component({
    selector: 'app-admin-leads-pipeline',
    standalone: true,
    imports: [CommonModule, RouterLink, DragDropModule],
    template: `
        <div class="admin-page-header">
            <h1 class="admin-page-title">Pipeline</h1>
            <div style="display:flex;gap:0.75rem">
                <a routerLink="/admin/leads" class="btn-text"><i class="bi bi-list-ul"></i> List view</a>
                <a routerLink="/admin/leads/new" class="btn-primary">New Lead</a>
            </div>
        </div>

        @if (loading()) {
            <div class="loading-state"><div class="spinner"></div></div>
        } @else {
            <div class="pipeline" cdkDropListGroup>
                @for (col of columns(); track col.status) {
                    <div class="pipeline-col">
                        <div class="pipeline-col-head" [style.borderTopColor]="col.accent">
                            <span class="pipeline-col-title">{{ col.label }}</span>
                            <span class="pipeline-col-count">{{ col.leads.length }}</span>
                        </div>
                        <div
                            class="pipeline-col-body"
                            cdkDropList
                            [id]="col.status"
                            [cdkDropListData]="col.leads"
                            (cdkDropListDropped)="onDrop($event, col.status)">
                            @for (lead of col.leads; track lead.id) {
                                <div class="pipeline-card" cdkDrag>
                                    <div class="pipeline-card-preview" *cdkDragPreview>{{ lead.name }}</div>
                                    <div class="pipeline-card-top">
                                        <a [routerLink]="['/admin/leads', lead.id]" class="pipeline-card-name">{{ lead.name }}</a>
                                        <span class="admin-badge">{{ sourceLabel(lead.source) }}</span>
                                    </div>
                                    <div class="pipeline-card-email">{{ lead.email }}</div>
                                    @if (lead.budget) {
                                        <div class="pipeline-card-budget"><i class="bi bi-cash-coin"></i> {{ lead.budget }}</div>
                                    }
                                    <div class="pipeline-card-date">{{ formatDate(lead.createdAt) }}</div>
                                </div>
                            }
                            @if (col.leads.length === 0) {
                                <div class="pipeline-empty">Drop here</div>
                            }
                        </div>
                    </div>
                }
            </div>
        }
    `,
    styles: [`
        .pipeline {
            display: flex;
            gap: 1rem;
            overflow-x: auto;
            padding-bottom: 1rem;
            align-items: flex-start;
        }
        .pipeline-col {
            flex: 0 0 260px;
            background: var(--bg-alt);
            border: 1px solid var(--border);
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            max-height: calc(100vh - 220px);
        }
        .pipeline-col-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.75rem 1rem;
            border-top: 3px solid var(--border);
            border-bottom: 1px solid var(--border);
        }
        .pipeline-col-title { font-weight: 600; font-size: 0.85rem; letter-spacing: 0.02em; }
        .pipeline-col-count {
            font-size: 0.72rem; font-weight: 600; color: var(--text-muted);
            background: rgba(var(--text-rgb), 0.06); border-radius: 999px; padding: 0.05rem 0.5rem;
        }
        .pipeline-col-body {
            padding: 0.75rem; overflow-y: auto; flex: 1; min-height: 80px;
            display: flex; flex-direction: column; gap: 0.6rem;
        }
        .pipeline-card {
            background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
            padding: 0.7rem 0.8rem; cursor: grab;
            box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }
        .pipeline-card:active { cursor: grabbing; }
        .pipeline-card-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
        .pipeline-card-name { font-weight: 600; font-size: 0.85rem; text-decoration: none; color: var(--text); }
        .pipeline-card-name:hover { text-decoration: underline; }
        .pipeline-card-email { font-size: 0.76rem; color: var(--text-muted); margin-top: 0.2rem; word-break: break-all; }
        .pipeline-card-budget { font-size: 0.74rem; color: var(--text); margin-top: 0.35rem; }
        .pipeline-card-date { font-size: 0.68rem; color: var(--text-muted); margin-top: 0.4rem; font-family: var(--font-mono); }
        .pipeline-empty {
            text-align: center; color: var(--text-muted); font-size: 0.74rem;
            border: 1px dashed var(--border); border-radius: 6px; padding: 1rem 0.5rem;
        }
        .pipeline-card-preview {
            background: var(--bg-alt); border: 1px solid var(--border); border-radius: 6px;
            padding: 0.5rem 0.8rem; font-weight: 600; font-size: 0.85rem;
            box-shadow: 0 6px 20px rgba(0,0,0,0.35);
        }
        .cdk-drag-placeholder { opacity: 0.4; }
        .cdk-drop-list-dragging .pipeline-card:not(.cdk-drag-placeholder) { transition: transform 0.2s; }
    `],
})
export class AdminLeadsPipelineComponent implements OnInit, OnDestroy {
    private readonly svc = inject(LeadsService);
    private readonly realtime = inject(RealtimeService);
    private readonly subs = new Subscription();

    readonly loading = signal(true);
    readonly columns = signal<PipelineColumn[]>(
        COLUMN_DEFS.map(d => ({ ...d, leads: [] })),
    );

    ngOnInit(): void {
        this.load();
        this.subs.add(this.realtime.on<Lead>('lead:created').subscribe(lead => this.upsert(lead)));
        this.subs.add(this.realtime.on<Lead>('lead:updated').subscribe(lead => this.upsert(lead)));
        this.subs.add(this.realtime.on<{ id: string }>('lead:deleted').subscribe(({ id }) => this.removeCard(id)));
    }

    ngOnDestroy(): void {
        this.subs.unsubscribe();
    }

    private load(): void {
        this.loading.set(true);
        this.svc.getAll().subscribe({
            next: leads => { this.distribute(leads); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
    }

    /** Re-buckets a fresh list of leads into columns by status. */
    private distribute(leads: Lead[]): void {
        const byStatus = new Map<LeadStatus, Lead[]>();
        for (const def of COLUMN_DEFS) byStatus.set(def.status, []);
        for (const lead of leads) (byStatus.get(lead.status) ?? byStatus.get('new')!).push(lead);
        this.columns.set(COLUMN_DEFS.map(d => ({ ...d, leads: byStatus.get(d.status) ?? [] })));
    }

    /** Insert or move a lead arriving via realtime into its correct column. */
    private upsert(lead: Lead): void {
        const cols = this.columns().map(c => ({ ...c, leads: c.leads.filter(l => l.id !== lead.id) }));
        const target = cols.find(c => c.status === lead.status) ?? cols[0];
        target.leads = [lead, ...target.leads];
        this.columns.set(cols);
    }

    private removeCard(id: string): void {
        this.columns.set(this.columns().map(c => ({ ...c, leads: c.leads.filter(l => l.id !== id) })));
    }

    onDrop(event: CdkDragDrop<Lead[]>, target: LeadStatus): void {
        if (event.previousContainer === event.container) return;

        const lead = event.previousContainer.data[event.previousIndex];
        const previous = lead.status;

        transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
        lead.status = target;
        this.columns.set([...this.columns()]);

        this.svc.update(lead.id, { status: target }).subscribe({
            error: () => {
                // Persist failed — revert the card to its original column.
                lead.status = previous;
                this.load();
            },
        });
    }

    sourceLabel(source: string): string { return SOURCE_LABELS[source] ?? source; }

    formatDate(d: string): string {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}
