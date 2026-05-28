import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FeedbackService } from '../../../core/services/inquiry-feedback.service';
import { UserInfoService } from '../../../core/services/user-info.service';
import { RealtimeService } from '../../../core/services/realtime.service';

@Component({
    selector: 'app-feedback',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './feedback.component.html',
})
export class FeedbackComponent implements OnInit, OnDestroy {
    private service = inject(FeedbackService);
    private userInfo = inject(UserInfoService);
    private readonly realtime = inject(RealtimeService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    readonly sending = signal(false);
    readonly sent = signal(false);
    readonly error = signal('');
    readonly reviews = signal<any[]>([]);
    readonly loadingReviews = signal(true);
    selectedRating = 5;
    readonly stars = [1, 2, 3, 4, 5];
    private subs = new Subscription();

    formData = { name: '', email: '', role: '', company: '', review: '' };

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

    private loadReviews() {
        this.loadingReviews.set(true);
        this.service.getApprovedPaginated(this.currentPage(), this.pageSize(), this.searchQuery() || undefined)
            .subscribe({
                next: (res) => {
                    this.reviews.set(res.data);
                    this.total.set(res.total);
                    this.totalPages.set(res.totalPages);
                    this.loadingReviews.set(false);
                },
                error: () => this.loadingReviews.set(false),
            });
    }

    onSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.searchQuery.set(value);
            this.currentPage.set(1);
            this.loadReviews();
            this.syncUrl();
        }, 400);
    }

    onPageSizeChange(e: Event) {
        this.pageSize.set(+(e.target as HTMLSelectElement).value);
        this.currentPage.set(1);
        this.loadReviews();
        this.syncUrl();
    }

    goToPage(n: number) {
        this.currentPage.set(n);
        this.loadReviews();
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

        const saved = this.userInfo.get();
        if (saved) {
            this.formData = { ...this.formData, name: saved.name ?? '', email: saved.email ?? '' };
        }
        this.loadReviews();

        // Admin approved/unapproved/deleted → reload current page
        this.subs.add(this.realtime.on<any>('feedback:approved').subscribe(() => this.loadReviews()));
        this.subs.add(this.realtime.on<{ id: string }>('feedback:unapproved').subscribe(() => this.loadReviews()));
        this.subs.add(this.realtime.on<{ id: string }>('feedback:deleted').subscribe(() => this.loadReviews()));
    }

    ngOnDestroy() { this.subs.unsubscribe(); clearTimeout(this.searchTimer); }

    submit(form: NgForm) {
        form.form.markAllAsTouched();
        if (form.invalid) return;
        this.sending.set(true);
        this.error.set('');
        this.service.submit({ ...form.value, rating: this.selectedRating }).subscribe({
            next: () => {
                this.userInfo.save({ name: form.value.name, email: form.value.email });
                this.sent.set(true);
                this.sending.set(false);
                form.reset();
                this.selectedRating = 5;
            },
            error: () => { this.error.set('Something went wrong. Please try again.'); this.sending.set(false); },
        });
    }
}
