import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GalleryService, GalleryItem } from '../../../core/services/gallery.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { AdminListBase } from '../../../shared/admin-list.base';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
    selector: 'app-admin-gallery',
    standalone: true,
    imports: [CommonModule, DatePipe, ImgFallbackDirective, PaginationComponent, ConfirmModalComponent],
    templateUrl: './admin-gallery.component.html',
})
export class AdminGalleryComponent extends AdminListBase implements OnInit, OnDestroy {
    private service = inject(GalleryService);
    private realtime = inject(RealtimeService);
    private readonly router = inject(Router);
    private subs = new Subscription();

    readonly items = signal<GalleryItem[]>([]);
    readonly loading = signal(true);
    readonly statusModal = signal<{ id: string } | null>(null);

    readonly sortedItems = computed(() =>
        [...this.items()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    );

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

    override readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredItems().length / this.pageSize()))
    );

    ngOnInit() {
        this.load();

        this.subs.add(this.realtime.on<GalleryItem>('gallery:created').subscribe(item => {
            this.items.update(list => list.some(i => i.id === item.id) ? list : [item, ...list]);
        }));

        // gallery:updated carries the full item (incl. isPublished), so hide/publish
        // changes made elsewhere are reflected here in-place.
        this.subs.add(this.realtime.on<GalleryItem>('gallery:updated').subscribe(item => {
            this.items.update(list => list.map(i => i.id === item.id ? item : i));
        }));

        this.subs.add(this.realtime.on<{ id: string }>('gallery:deleted').subscribe(({ id }) => {
            this.items.update(list => list.filter(i => i.id !== id));
        }));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    load() {
        this.loading.set(true);
        this.service.getAllAdmin().subscribe({
            next: (d) => { this.items.set(d); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
    }

    openNew() { this.router.navigate(['/admin/gallery/new']); }

    edit(item: GalleryItem) { this.router.navigate(['/admin/gallery', item.id, 'edit']); }

    override executeDelete(): void {
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
        this.setPublished(m.id, false);
    }

    publishItem(item: GalleryItem) { this.setPublished(item.id, true); }

    private setPublished(id: string, isPublished: boolean) {
        const item = this.items().find(i => i.id === id);
        if (!item) return;
        // optimistic update; revert on failure
        this.items.update(list => list.map(i => i.id === id ? { ...i, isPublished } : i));
        this.service.update(id, { isPublished }).subscribe({
            error: () => this.items.update(list => list.map(i => i.id === id ? item : i)),
        });
    }
}
