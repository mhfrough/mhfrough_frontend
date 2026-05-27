import {
    Component, OnInit, OnDestroy, inject, signal, computed,
    HostListener, PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser, CommonModule, DatePipe } from '@angular/common';
import { GalleryService, GalleryItem } from '../../../core/services/gallery.service';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';

@Component({
    selector: 'app-gallery',
    standalone: true,
    imports: [CommonModule, DatePipe, ImgFallbackDirective],
    templateUrl: './gallery.component.html',
})
export class GalleryComponent implements OnInit, OnDestroy {
    private galleryService = inject(GalleryService);
    private platformId = inject(PLATFORM_ID);

    readonly items = signal<GalleryItem[]>([]);
    readonly loading = signal(true);
    readonly selectedCategory = signal<string>('all');
    readonly lightboxIndex = signal<number | null>(null);
    readonly zoomLevel = signal(1);

    readonly categories = computed(() => {
        const cats = this.items()
            .map(i => i.category)
            .filter((c): c is string => !!c);
        return [...new Set(cats)];
    });

    readonly filteredItems = computed(() => {
        const cat = this.selectedCategory();
        if (cat === 'all') return this.items();
        return this.items().filter(i => i.category === cat);
    });

    readonly lightboxItem = computed(() => {
        const idx = this.lightboxIndex();
        if (idx === null) return null;
        return this.filteredItems()[idx] ?? null;
    });

    ngOnInit() {
        this.galleryService.getAll().subscribe({
            next: (data) => { this.items.set(data); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
    }

    ngOnDestroy() { this.closeLightbox(); }

    selectCategory(cat: string) {
        this.selectedCategory.set(cat);
        this.closeLightbox();
    }

    openLightbox(index: number) {
        this.lightboxIndex.set(index);
        this.zoomLevel.set(1);
        if (isPlatformBrowser(this.platformId)) {
            document.body.style.overflow = 'hidden';
        }
    }

    closeLightbox() {
        this.lightboxIndex.set(null);
        this.zoomLevel.set(1);
        if (isPlatformBrowser(this.platformId)) {
            document.body.style.overflow = '';
        }
    }

    prevItem() {
        const idx = this.lightboxIndex();
        if (idx === null) return;
        const total = this.filteredItems().length;
        this.lightboxIndex.set((idx - 1 + total) % total);
        this.zoomLevel.set(1);
    }

    nextItem() {
        const idx = this.lightboxIndex();
        if (idx === null) return;
        const total = this.filteredItems().length;
        this.lightboxIndex.set((idx + 1) % total);
        this.zoomLevel.set(1);
    }

    zoomIn() {
        this.zoomLevel.update(z => Math.min(z + 0.5, 3));
    }

    zoomOut() {
        this.zoomLevel.update(z => Math.max(z - 0.5, 0.5));
    }

    resetZoom() {
        this.zoomLevel.set(1);
    }

    formatBytes(bytes: number): string {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    @HostListener('document:keydown', ['$event'])
    onKeydown(e: KeyboardEvent) {
        if (this.lightboxIndex() === null) return;
        if (e.key === 'Escape') { this.closeLightbox(); return; }
        if (e.key === 'ArrowLeft') { this.prevItem(); return; }
        if (e.key === 'ArrowRight') { this.nextItem(); return; }
        if (e.key === '+' || e.key === '=') { this.zoomIn(); return; }
        if (e.key === '-') { this.zoomOut(); return; }
    }
}
