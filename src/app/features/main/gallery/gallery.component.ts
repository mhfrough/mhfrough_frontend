import {
    Component, OnInit, OnDestroy, inject, signal, computed,
    HostListener, PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser, CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GalleryService, GalleryItem } from '../../../core/services/gallery.service';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';

@Component({
    selector: 'app-gallery',
    standalone: true,
    imports: [CommonModule, DatePipe, ImgFallbackDirective, FormsModule],
    templateUrl: './gallery.component.html',
})
export class GalleryComponent implements OnInit, OnDestroy {
    private galleryService = inject(GalleryService);
    private platformId = inject(PLATFORM_ID);

    readonly PAGE_SIZE = 24;

    readonly items = signal<GalleryItem[]>([]);
    readonly total = signal(0);
    readonly hasMore = signal(false);
    readonly loading = signal(true);
    readonly loadingMore = signal(false);

    readonly categories = signal<string[]>([]);
    readonly selectedCategory = signal<string>('all');
    readonly searchQuery = signal('');
    readonly allTags = signal<string[]>([]);
    readonly selectedTag = signal<string>('all');

    readonly lightboxIndex = signal<number | null>(null);
    readonly zoomLevel = signal(1);

    readonly lightboxItem = computed(() => {
        const idx = this.lightboxIndex();
        if (idx === null) return null;
        return this.items()[idx] ?? null;
    });

    private currentPage = 1;
    private searchTimer?: ReturnType<typeof setTimeout>;

    ngOnInit() {
        this.galleryService.getCategories().subscribe({
            next: (cats) => this.categories.set(cats),
        });
        this.galleryService.getTags().subscribe({
            next: (tags) => this.allTags.set(tags),
        });
        this.loadPage(1, true);
    }

    ngOnDestroy() {
        clearTimeout(this.searchTimer);
        this.closeLightbox();
    }

    private loadPage(page: number, reset: boolean) {
        if (reset) {
            this.loading.set(true);
        } else {
            this.loadingMore.set(true);
        }
        const q = this.searchQuery() || undefined;
        const cat = this.selectedCategory() !== 'all' ? this.selectedCategory() : undefined;
        const tag = this.selectedTag() !== 'all' ? this.selectedTag() : undefined;
        this.galleryService.getPublicPaginated(page, this.PAGE_SIZE, q, cat, tag).subscribe({
            next: (res) => {
                if (reset) {
                    this.items.set(res.data);
                } else {
                    this.items.update(prev => [...prev, ...res.data]);
                }
                this.total.set(res.total);
                this.currentPage = page;
                this.hasMore.set(page < res.totalPages);
                this.loading.set(false);
                this.loadingMore.set(false);
            },
            error: () => {
                this.loading.set(false);
                this.loadingMore.set(false);
            },
        });
    }

    loadMore() {
        if (!this.hasMore() || this.loadingMore() || this.loading()) return;
        this.loadPage(this.currentPage + 1, false);
    }

    selectCategory(cat: string) {
        this.selectedCategory.set(cat);
        this.closeLightbox();
        this.loadPage(1, true);
    }

    selectTag(tag: string) {
        this.selectedTag.set(tag);
        this.closeLightbox();
        this.loadPage(1, true);
    }

    onSearch(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.searchQuery.set(value);
            this.loadPage(1, true);
        }, 350);
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
        this.lightboxIndex.set((idx - 1 + this.items().length) % this.items().length);
        this.zoomLevel.set(1);
    }

    nextItem() {
        const idx = this.lightboxIndex();
        if (idx === null) return;
        this.lightboxIndex.set((idx + 1) % this.items().length);
        this.zoomLevel.set(1);
    }

    zoomIn() { this.zoomLevel.update(z => Math.min(z + 0.5, 3)); }
    zoomOut() { this.zoomLevel.update(z => Math.max(z - 0.5, 0.5)); }
    resetZoom() { this.zoomLevel.set(1); }

    formatBytes(bytes: number): string {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    @HostListener('window:scroll', [])
    onWindowScroll() {
        if (!isPlatformBrowser(this.platformId)) return;
        if (!this.hasMore() || this.loadingMore() || this.loading()) return;
        const scrolled = window.scrollY + window.innerHeight;
        const pageHeight = document.documentElement.scrollHeight;
        if (scrolled >= pageHeight - 300) {
            this.loadMore();
        }
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

