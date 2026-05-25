import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';
import { FeedbackService } from '../../../core/services/inquiry-feedback.service';
import { BlogsService } from '../../../core/services/blogs.service';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    private readonly http = inject(HttpClient);
    private readonly notif = inject(AdminNotificationService);
    private readonly feedbackService = inject(FeedbackService);
    private readonly blogsService = inject(BlogsService);
    readonly stats = signal<any>(null);
    readonly recentReviews = signal<any[]>([]);
    readonly recentComments = signal<any[]>([]);
    private subs = new Subscription();

    ngOnInit() {
        this.load();
        this.subs.add(this.notif.inquiriesChanged$.subscribe(() => this.load()));
        this.subs.add(this.notif.feedbackChanged$.subscribe(() => {
            this.load();
            this.loadReviews();
        }));
        this.subs.add(this.notif.commentsChanged$.subscribe(() => {
            this.load();
            this.loadComments();
        }));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    private load() {
        this.http.get(`${environment.apiUrl}/admin/dashboard`).subscribe({
            next: (data) => this.stats.set(data),
        });
        this.loadReviews();
        this.loadComments();
    }

    private loadReviews() {
        this.feedbackService.getAll().subscribe({
            next: (data: any[]) => {
                const pending = data.filter((f: any) => !f.isApproved);
                this.recentReviews.set(pending.slice(0, 5));
            },
        });
    }

    private loadComments() {
        this.blogsService.getPendingComments().subscribe({
            next: (data: any[]) => this.recentComments.set(data.slice(0, 5)),
        });
    }

    approveReview(id: string) {
        this.feedbackService.approve(id).subscribe(() => {
            this.notif.fetchCounts();
            this.loadReviews();
            this.load();
        });
    }

    approveComment(id: string) {
        this.blogsService.approveComment(id).subscribe(() => {
            this.notif.fetchCounts();
            this.loadComments();
            this.load();
        });
    }
}
