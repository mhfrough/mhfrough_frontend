import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { BlogsService } from '../../../../core/services/blogs.service';
import { ImgFallbackDirective } from '../../../../shared/directives/img-fallback.directive';

@Component({
    selector: 'app-blog-list',
    standalone: true,
    imports: [CommonModule, RouterLink, ImgFallbackDirective],
    templateUrl: './blog-list.component.html',
})
export class BlogListComponent implements OnInit {
    private service = inject(BlogsService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    readonly blogs = signal<any[]>([]);
    readonly loading = signal(true);

    // ── Pagination + Search ──────────────────────────────────────────────────
    readonly searchQuery = signal('');
    readonly pageSize = signal(12);
    readonly currentPage = signal(1);
    readonly total = signal(0);
    readonly totalPages = signal(1);

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
        this.service.getPublic(this.currentPage(), this.pageSize(), this.searchQuery() || undefined)
            .subscribe({
                next: (res) => {
                    this.blogs.set(res.data);
                    this.total.set(res.total);
                    this.totalPages.set(res.totalPages);
                    this.loading.set(false);
                },
                error: () => this.loading.set(false),
            });
    }

    onSearch(e: Event) {
        this.searchQuery.set((e.target as HTMLInputElement).value);
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
    }
}
