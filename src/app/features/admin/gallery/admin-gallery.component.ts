import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GalleryService, GalleryItem } from '../../../core/services/gallery.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';

@Component({
    selector: 'app-admin-gallery',
    standalone: true,
    imports: [CommonModule, DatePipe, ImgFallbackDirective],
    templateUrl: './admin-gallery.component.html',
})
export class AdminGalleryComponent implements OnInit, OnDestroy {
    private service = inject(GalleryService);
    private realtime = inject(RealtimeService);
    private readonly router = inject(Router);
    private subs = new Subscription();

    readonly items = signal<GalleryItem[]>([]);
    readonly loading = signal(true);
    readonly deleteTargetId = signal<string | null>(null);
    readonly statusModal = signal<{ id: string } | null>(null);

    // ── Pagination + Search ──────────────────────────────────────────────────
    readonly searchQuery = signal('');
    readonly pageSize = signal(25);
    readonly currentPage = signal(1);

    readonly filteredItems = computed(() => {
        const q = this.searchQuery().toLowerCase().trim();
        const sorted = this.sortedItems();
        if (!q) return sorted;
        return sorted.filter(item =>
            item.title?.toLowerCase().includes(q) ||
            item.category?.toLowerCase().includes(q) ||
            item.caption?.toLowerCase().includes(q)
        );
    });

    readonly pagedItems = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.filteredItems().slice(start, start + this.pageSize());
    });

    readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredItems().length / this.pageSize()))
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

    ngOnInit() {
        this.load();

        this.subs.add(this.realtime.on<GalleryItem>('gallery:created').subscribe(item => {
            this.items.update(list => [item, ...list]);
        }));

        this.subs.add(this.realtime.on<GalleryItem>('gallery:updated').subscribe(item => {
            this.items.update(list => list.map(i => i.id === item.id ? item : i));
        }));

        this.subs.add(this.realtime.on<{ id: string }>('gallery:deleted').subscribe(({ id }) => {
            this.items.update(list => list.filter(i => i.id !== id));
        }));

    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    load() {
        this.service.getAllAdmin().subscribe({
            next: (d) => { this.items.set(d); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
    }

    openNew() { this.router.navigate(['/admin/gallery/new']); }

    edit(item: GalleryItem) { this.router.navigate(['/admin/gallery', item.id, 'edit']); }

    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }

    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe();
    }

    openHideModal(id: string) { this.statusModal.set({ id }); }
    cancelStatus() { this.statusModal.set(null); }
    executeStatus() {
        const m = this.statusModal();
        if (!m) return;
        this.statusModal.set(null);
        const item = this.items().find(i => i.id === m.id);
        if (!item) return;
        const updated = { ...item, isPublished: false };
        this.items.update(list => list.map(i => i.id === m.id ? updated : i));
        this.service.update(m.id, { isPublished: false }).subscribe({
            error: () => this.items.update(list => list.map(i => i.id === m.id ? item : i)),
        });
    }

    publishItem(item: GalleryItem) {
        const updated = { ...item, isPublished: true };
        this.items.update(list => list.map(i => i.id === item.id ? updated : i));
        this.service.update(item.id, { isPublished: true }).subscribe({
            error: () => this.items.update(list => list.map(i => i.id === item.id ? item : i)),
        });
    }

    sortedItems() {
        return [...this.items()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
}
