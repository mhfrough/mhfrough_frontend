import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { BlogsService } from '../../../core/services/blogs.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { AdminListBase } from '../../../shared/admin-list.base';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ReasonModalComponent } from '../../../shared/components/reason-modal/reason-modal.component';

@Component({
    selector: 'app-admin-blogs',
    standalone: true,
    imports: [CommonModule, RouterLink, RouterLinkActive, PaginationComponent, ConfirmModalComponent, ReasonModalComponent],
    templateUrl: './admin-blogs.component.html',
})
export class AdminBlogsComponent extends AdminListBase implements OnInit, OnDestroy {
    private service = inject(BlogsService);
    private readonly router = inject(Router);
    private readonly realtime = inject(RealtimeService);
    readonly notif = inject(AdminNotificationService);

    readonly blogs = signal<any[]>([]);
    readonly loading = signal(true);
    readonly statusModal = signal<{ id: string; title: string } | null>(null);
    private readonly subs = new Subscription();

    readonly filteredBlogs = computed(() => {
        const q = this.searchQuery().toLowerCase().trim();
        if (!q) return this.blogs();
        return this.blogs().filter(b =>
            b.title?.toLowerCase().includes(q) ||
            b.slug?.toLowerCase().includes(q) ||
            b.tags?.some((t: string) => t.toLowerCase().includes(q))
        );
    });

    readonly pagedBlogs = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.filteredBlogs().slice(start, start + this.pageSize());
    });

    override readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredBlogs().length / this.pageSize()))
    );

    ngOnInit() {
        this.load();

        // blog:created → prepend to list
        this.subs.add(this.realtime.on<any>('blog:created').subscribe(blog => {
            this.blogs.update(list => list.some(b => b.id === blog.id) ? list : [blog, ...list]);
        }));

        // blog:updated → update in-place
        this.subs.add(this.realtime.on<any>('blog:updated').subscribe(blog => {
            this.blogs.update(list => list.map(b => b.id === blog.id ? blog : b));
        }));

        // blog:unpublished → flip isPublished in-place
        this.subs.add(this.realtime.on<{ id: string }>('blog:unpublished').subscribe(({ id }) => {
            this.blogs.update(list => list.map(b => b.id === id ? { ...b, isPublished: false } : b));
        }));

        // blog:deleted → remove from list
        this.subs.add(this.realtime.on<{ id: string }>('blog:deleted').subscribe(({ id }) => {
            this.blogs.update(list => list.filter(b => b.id !== id));
        }));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    load() {
        this.loading.set(true);
        this.service.getAllAdmin().subscribe({
            next: (d: any[]) => { this.blogs.set(d); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
    }

    openNew() { this.router.navigate(['/admin/blogs/new']); }

    edit(b: any) { this.router.navigate(['/admin/blogs', b.id, 'edit']); }

    override executeDelete(): void {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe(() => this.load());
    }

    openStatusModal(id: string): void { this.statusModal.set({ id, title: 'Unpublish Blog Post' }); }
    cancelStatus(): void { this.statusModal.set(null); }
    executeStatus(reason: string): void {
        const m = this.statusModal();
        if (!m) return;
        this.statusModal.set(null);
        this.service.unpublish(m.id, reason || undefined).subscribe(() => this.load());
    }
}
