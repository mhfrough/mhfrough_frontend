import { Component, OnInit, OnDestroy, inject, signal, computed, HostListener, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProjectsService } from '../../../core/services/projects.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { ExternalUrlPipe } from '../../../shared/pipes/external-url.pipe';

@Component({
    selector: 'app-projects',
    standalone: true,
    imports: [CommonModule, RouterLink, NgOptimizedImage, ImgFallbackDirective, ExternalUrlPipe],
    templateUrl: './projects.component.html',
})
export class ProjectsComponent implements OnInit, OnDestroy {
    private projectsService = inject(ProjectsService);
    private platformId = inject(PLATFORM_ID);
    private readonly realtime = inject(RealtimeService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    readonly projects = signal<any[]>([]);
    readonly loading = signal(true);
    readonly lightboxSrc = signal<string | null>(null);
    private subs = new Subscription();

    // ── Pagination + Search ──────────────────────────────────────────────────
    readonly searchQuery = signal('');
    readonly pageSize = signal(5);
    readonly currentPage = signal(1);
    readonly total = signal(0);
    readonly totalPages = signal(1);

    private searchTimer?: ReturnType<typeof setTimeout>;

    get pageNumbers(): number[] {
        const total = this.totalPages();
        const cur = this.currentPage();
        const pages: number[] = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) {
            pages.push(i);
        }
        return pages;
    }

    private load() {
        this.loading.set(true);
        this.projectsService.getPublic(this.currentPage(), this.pageSize(), this.searchQuery() || undefined)
            .subscribe({
                next: (res) => {
                    this.projects.set(res.data);
                    this.total.set(res.total);
                    this.totalPages.set(res.totalPages);
                    this.loading.set(false);
                },
                error: () => this.loading.set(false),
            });
    }

    onSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.searchQuery.set(value);
            this.currentPage.set(1);
            this.load();
            this.syncUrl();
        }, 400);
    }

    onPageSizeChange(e: Event) {
        this.pageSize.set(+(e.target as HTMLSelectElement).value);
        this.currentPage.set(1);
        this.load();
        this.syncUrl();
    }

    goToPage(n: number) {
        this.currentPage.set(n);
        this.load();
        this.syncUrl();
    }

    private syncUrl() {
        const q = this.searchQuery();
        const page = this.currentPage();
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { q: q || null, page: page > 1 ? page : null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    ngOnInit() {
        const p = this.route.snapshot.queryParams;
        if (p['q']) this.searchQuery.set(p['q']);
        if (p['page']) this.currentPage.set(+p['page']);

        this.load();

        this.subs.add(this.realtime.on<any>('project:created').subscribe(() => this.load()));
        this.subs.add(this.realtime.on<any>('project:updated').subscribe(() => this.load()));
        this.subs.add(this.realtime.on<{ id: string }>('project:unpublished').subscribe(() => this.load()));
        this.subs.add(this.realtime.on<{ id: string }>('project:deleted').subscribe(() => this.load()));
    }

    ngOnDestroy() {
        clearTimeout(this.searchTimer);
        this.subs.unsubscribe();
        this.closeLightbox();
    }

    openLightbox(src: string) {
        this.lightboxSrc.set(src);
        if (isPlatformBrowser(this.platformId)) {
            document.body.style.overflow = 'hidden';
        }
    }

    closeLightbox() {
        this.lightboxSrc.set(null);
        if (isPlatformBrowser(this.platformId)) {
            document.body.style.overflow = '';
        }
    }

    @HostListener('document:keydown.escape')
    onEscape() {
        this.closeLightbox();
    }
}
