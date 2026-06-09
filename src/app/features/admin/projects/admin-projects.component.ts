import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProjectsService } from '../../../core/services/projects.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { Subscription } from 'rxjs';
@Component({
    selector: 'app-admin-projects',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './admin-projects.component.html',
})
export class AdminProjectsComponent implements OnInit, OnDestroy {
    private service = inject(ProjectsService);
    private readonly realtime = inject(RealtimeService);
    private readonly router = inject(Router);
    readonly projects = signal<any[]>([]);
    readonly loading = signal(true);
    readonly deleteTargetId = signal<string | null>(null);
    readonly statusModal = signal<{ id: string; title: string; reason: string } | null>(null);
    private subs = new Subscription();

    // ── Pagination + Search ──────────────────────────────────────────────────
    readonly searchQuery = signal('');
    readonly pageSize = signal(25);
    readonly currentPage = signal(1);

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

    readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredProjects().length / this.pageSize()))
    );

    get pageNumbers(): number[] {
        const total = this.totalPages();
        const cur = this.currentPage();
        const pages: number[] = [];
        const delta = 2;
        for (let i = Math.max(1, cur - delta); i <= Math.min(total, cur + delta); i++) {
            pages.push(i);
        }
        return pages;
    }

    onSearch(e: Event) {
        this.searchQuery.set((e.target as HTMLInputElement).value);
        this.currentPage.set(1);
    }

    onPageSizeChange(e: Event) {
        this.pageSize.set(+(e.target as HTMLSelectElement).value);
        this.currentPage.set(1);
    }

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

    openNew() { this.router.navigate(['/admin/projects/new']); }

    edit(p: any) { this.router.navigate(['/admin/projects', p.id, 'edit']); }

    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }

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

}

