import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProjectsService } from '../../../core/services/projects.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { AdminListBase } from '../../../shared/admin-list.base';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ReasonModalComponent } from '../../../shared/components/reason-modal/reason-modal.component';

@Component({
    selector: 'app-admin-projects',
    standalone: true,
    imports: [CommonModule, PaginationComponent, ConfirmModalComponent, ReasonModalComponent],
    templateUrl: './admin-projects.component.html',
})
export class AdminProjectsComponent extends AdminListBase implements OnInit, OnDestroy {
    private service = inject(ProjectsService);
    private readonly realtime = inject(RealtimeService);
    private readonly router = inject(Router);

    readonly projects = signal<any[]>([]);
    readonly loading = signal(true);
    readonly statusModal = signal<{ id: string; title: string } | null>(null);
    private subs = new Subscription();

    readonly filteredProjects = computed(() => {
        const q = this.searchQuery().toLowerCase().trim();
        if (!q) return this.projects();
        return this.projects().filter(p =>
            p.title?.toLowerCase().includes(q) ||
            p.techStack?.some((t: string) => t.toLowerCase().includes(q))
        );
    });

    readonly pagedProjects = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.filteredProjects().slice(start, start + this.pageSize());
    });

    override readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredProjects().length / this.pageSize()))
    );

    ngOnInit() {
        this.load();

        // project:created → prepend to list
        this.subs.add(this.realtime.on<any>('project:created').subscribe(project => {
            this.projects.update(list => list.some(p => p.id === project.id) ? list : [project, ...list]);
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
        this.loading.set(true);
        this.service.getAllAdmin().subscribe({
            next: (d: any[]) => { this.projects.set(d); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
    }

    openNew() { this.router.navigate(['/admin/projects/new']); }

    edit(p: any) { this.router.navigate(['/admin/projects', p.id, 'edit']); }

    toggleFeatured(p: any) {
        const newVal = !p.featured;
        // optimistic update so the star flips immediately
        this.projects.update(list => list.map(x => x.id === p.id ? { ...x, featured: newVal } : x));
        this.service.patchFeatured(p.id, newVal).subscribe({
            error: () => {
                // revert on failure
                this.projects.update(list => list.map(x => x.id === p.id ? { ...x, featured: p.featured } : x));
            },
        });
    }

    override executeDelete(): void {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe(() => this.load());
    }

    openStatusModal(id: string): void { this.statusModal.set({ id, title: 'Unpublish Project' }); }
    cancelStatus(): void { this.statusModal.set(null); }
    executeStatus(reason: string): void {
        const m = this.statusModal();
        if (!m) return;
        this.statusModal.set(null);
        this.service.unpublish(m.id, reason || undefined).subscribe(() => this.load());
    }
}
