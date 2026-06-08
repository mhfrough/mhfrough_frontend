import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { BlogsService } from '../../../../core/services/blogs.service';
import { ImgFallbackDirective } from '../../../../shared/directives/img-fallback.directive';
import { PreconnectService } from '../../../../core/services/preconnect.service';
import { Title } from '@angular/platform-browser';
import { SeoService } from '../../../../core/services/seo.service';

@Component({
    selector: 'app-blog-list',
    standalone: true,
    imports: [CommonModule, RouterLink, NgOptimizedImage, ImgFallbackDirective],
    templateUrl: './blog-list.component.html',
})
export class BlogListComponent implements OnInit, OnDestroy {
    private service = inject(BlogsService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private preconnect = inject(PreconnectService);
    private titleService = inject(Title);
    private seo = inject(SeoService);
    readonly blogs = signal<any[]>([]);
    readonly loading = signal(true);

    // ── Pagination + Search ──────────────────────────────────────────────────
    readonly searchQuery = signal('');
    readonly pageSize = signal(12);
    readonly currentPage = signal(1);
    readonly total = signal(0);
    readonly totalPages = signal(1);
    readonly allTags = signal<string[]>([]);
    readonly selectedTag = signal('all');

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
        this.service.getPublic(
            this.currentPage(), this.pageSize(),
            this.searchQuery() || undefined,
            this.selectedTag() !== 'all' ? this.selectedTag() : undefined,
        ).subscribe({
            next: (res) => {
                this.blogs.set(res.data);
                this.total.set(res.total);
                this.totalPages.set(res.totalPages);
                this.loading.set(false);
                if (this.currentPage() === 1) this.preconnect.add(res.data[0]?.coverImage);
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

    selectTag(tag: string) {
        this.selectedTag.set(tag);
        this.currentPage.set(1);
        this.load();
        this.syncUrl();
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
        const tag = this.selectedTag();
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { q: q || null, page: page > 1 ? page : null, tag: tag !== 'all' ? tag : null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    ngOnInit() {
        this.titleService.setTitle('Blog | Mohammad Hamza');
        this.seo.update({
            title: 'Blog | Mohammad Hamza',
            description: 'Articles and write-ups by Mohammad Hamza on web development, design and product engineering.',
            url: '/blog',
        });
        const p = this.route.snapshot.queryParams;
        if (p['q']) this.searchQuery.set(p['q']);
        if (p['page']) this.currentPage.set(+p['page']);
        if (p['tag']) this.selectedTag.set(p['tag']);

        this.service.getTags().subscribe({ next: t => this.allTags.set(t) });
        this.load();
    }

    ngOnDestroy() { clearTimeout(this.searchTimer); }
}
