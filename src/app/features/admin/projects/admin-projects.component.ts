import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ProjectsService } from '../../../core/services/projects.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-admin-projects',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './admin-projects.component.html',
})
export class AdminProjectsComponent implements OnInit, OnDestroy {
    private service = inject(ProjectsService);
    private readonly realtime = inject(RealtimeService);
    readonly projects = signal<any[]>([]);
    readonly loading = signal(true);
    readonly saving = signal(false);
    readonly editing = signal<any>(null);
    readonly showForm = signal(false);
    readonly deleteTargetId = signal<string | null>(null);
    readonly statusModal = signal<{ id: string; title: string; reason: string } | null>(null);
    private subs = new Subscription();

    ngOnInit() {
        this.load();

        // project:created → prepend to list
        this.subs.add(this.realtime.on<any>('project:created').subscribe(project => {
            this.projects.update(list => [project, ...list]);
        }));

        // project:updated → update in-place
        this.subs.add(this.realtime.on<any>('project:updated').subscribe(project => {
            this.projects.update(list => list.map(p => p.id === project.id ? project : p));
        }));

        // project:unpublished → update isPublished flag in-place
        this.subs.add(this.realtime.on<{ id: string }>('project:unpublished').subscribe(({ id }) => {
            this.projects.update(list => list.map(p => p.id === id ? { ...p, isPublished: false } : p));
        }));

        // project:deleted → remove from list
        this.subs.add(this.realtime.on<{ id: string }>('project:deleted').subscribe(({ id }) => {
            this.projects.update(list => list.filter(p => p.id !== id));
        }));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    load() {
        this.service.getAllAdmin().subscribe({ next: (d: any[]) => { this.projects.set(d); this.loading.set(false); } });
    }

    openNew() { this.editing.set(null); this.showForm.set(true); }

    edit(p: any) { this.editing.set({ ...p, techStack: p.techStack?.join(', ') }); this.showForm.set(true); }

    cancel() { this.showForm.set(false); this.editing.set(null); }

    save(form: NgForm) {
        form.form.markAllAsTouched();
        if (form.invalid) return;
        this.saving.set(true);
        const payload = { ...form.value, techStack: form.value.techStack?.split(',').map((s: string) => s.trim()).filter(Boolean) };
        const obs = this.editing() ? this.service.update(this.editing().id, payload) : this.service.create(payload);
        obs.subscribe({ next: () => { this.cancel(); this.saving.set(false); } });
    }

    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }

    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe();
    }

    openStatusModal(id: string) { this.statusModal.set({ id, title: 'Unpublish Project', reason: '' }); }
    cancelStatus() { this.statusModal.set(null); }
    setStatusReason(e: Event) {
        const val = (e.target as HTMLTextAreaElement).value;
        this.statusModal.update(m => m ? { ...m, reason: val } : null);
    }
    executeStatus() {
        const m = this.statusModal();
        if (!m) return;
        this.statusModal.set(null);
        this.service.unpublish(m.id, m.reason || undefined).subscribe();
    }

    format(el: HTMLTextAreaElement, open: string, close: string): void {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const sel = el.value.substring(start, end);
        const replacement = open + (sel || 'text') + close;
        el.setRangeText(replacement, start, end, 'select');
        el.focus();
        el.dispatchEvent(new Event('input'));
    }
}
