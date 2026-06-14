import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { BlogsService } from '../../../core/services/blogs.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';

@Component({
    selector: 'app-admin-blogs',
    standalone: true,
    imports: [CommonModule, RouterLink, RouterLinkActive],
    templateUrl: './admin-blogs.component.html',
})
export class AdminBlogsComponent implements OnInit {
    private service = inject(BlogsService);
    private readonly router = inject(Router);
    readonly notif = inject(AdminNotificationService);
    readonly blogs = signal<any[]>([]);
    readonly loading = signal(true);
    readonly deleteTargetId = signal<string | null>(null);
    readonly statusModal = signal<{ id: string; title: string; reason: string } | null>(null);

    // ── Pagination + Search ──────────────────────────────────────────────────
    readonly searchQuery = signal('');
    readonly pageSize = signal(25);
    readonly currentPage = signal(1);

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

    readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredBlogs().length / this.pageSize()))
    );

    get pageNumbers(): number[] {
        const total = this.totalPages();
        const cur = this.currentPage();
        const pages: number[] = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) {
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

    ngOnInit() { this.load(); }

    load() {
        this.service.getAllAdmin().subscribe({ next: (d: any[]) => { this.blogs.set(d); this.loading.set(false); } });
    }

    openNew() { this.router.navigate(['/admin/blogs/new']); }

    edit(b: any) { this.router.navigate(['/admin/blogs', b.id, 'edit']); }

    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }

    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe(() => this.load());
    }

    openStatusModal(id: string) { this.statusModal.set({ id, title: 'Unpublish Blog Post', reason: '' }); }
    cancelStatus() { this.statusModal.set(null); }
    setStatusReason(e: Event) {
        const val = (e.target as HTMLTextAreaElement).value;
        this.statusModal.update(m => m ? { ...m, reason: val } : null);
    }
    executeStatus() {
        const m = this.statusModal();
        if (!m) return;
        this.statusModal.set(null);
        this.service.unpublish(m.id, m.reason || undefined).subscribe(() => this.load());
    }

}

