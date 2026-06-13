import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminDataService, DatasetInfo, WIPE_CONFIRM_PHRASE, WipeResult } from '../../../../../core/services/admin-data.service';

@Component({
    selector: 'app-settings-data',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './settings-data.component.html',
    styleUrl: './settings-data.component.scss',
})
export class SettingsDataComponent implements OnInit {
    private readonly svc = inject(AdminDataService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly CONFIRM_PHRASE = WIPE_CONFIRM_PHRASE;

    readonly loading = signal(true);
    readonly datasets = signal<DatasetInfo[]>([]);

    readonly exporting = signal(false);
    readonly exportError = signal('');

    // Wipe form state
    readonly selected = signal<Set<string>>(new Set());
    password = '';
    confirmText = '';
    readonly wiping = signal(false);
    readonly wipeError = signal('');
    readonly wipeResult = signal<WipeResult | null>(null);
    readonly armed = signal(false); // two-step: arm, then execute

    readonly selectedCount = computed(() => this.selected().size);

    readonly canWipe = computed(() =>
        this.selectedCount() > 0 &&
        this.password.trim().length > 0 &&
        this.confirmText === this.CONFIRM_PHRASE &&
        !this.wiping(),
    );

    ngOnInit(): void {
        this.loadDatasets();
    }

    private loadDatasets(): void {
        this.loading.set(true);
        this.svc.datasets().subscribe({
            next: d => { this.datasets.set(d); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
    }

    isSelected(key: string): boolean {
        return this.selected().has(key);
    }

    /** "projects: 3, leads: 5" — summarises what a wipe removed. */
    objectEntriesText(rec: Record<string, number>): string {
        return Object.entries(rec).map(([k, v]) => `${k}: ${v}`).join(', ');
    }

    toggle(key: string): void {
        const next = new Set(this.selected());
        next.has(key) ? next.delete(key) : next.add(key);
        this.selected.set(next);
        this.armed.set(false);
    }

    // ── Export ────────────────────────────────────────────────────────────────
    exportData(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.exporting.set(true);
        this.exportError.set('');
        this.svc.export().subscribe({
            next: payload => {
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `mhfrough-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.exporting.set(false);
            },
            error: () => { this.exportError.set('Export failed. Please try again.'); this.exporting.set(false); },
        });
    }

    // ── Wipe (two-step) ─────────────────────────────────────────────────────────
    arm(): void {
        if (!this.canWipe()) return;
        this.armed.set(true);
        this.wipeError.set('');
    }

    cancelArm(): void {
        this.armed.set(false);
    }

    executeWipe(): void {
        if (!this.canWipe()) return;
        this.wiping.set(true);
        this.wipeError.set('');
        this.wipeResult.set(null);
        this.svc.wipe({
            password: this.password,
            confirm: this.confirmText,
            datasets: [...this.selected()],
        }).subscribe({
            next: res => {
                this.wipeResult.set(res);
                this.wiping.set(false);
                this.armed.set(false);
                this.password = '';
                this.confirmText = '';
                this.selected.set(new Set());
                this.loadDatasets();
            },
            error: err => {
                this.wiping.set(false);
                this.armed.set(false);
                this.wipeError.set(err?.error?.message ?? 'Wipe failed. Check your password and try again.');
            },
        });
    }
}
