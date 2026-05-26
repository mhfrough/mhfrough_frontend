import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';
import { FeedbackService, InquiriesService } from '../../../core/services/inquiry-feedback.service';
import { BlogsService } from '../../../core/services/blogs.service';
import { RealtimeService } from '../../../core/services/realtime.service';

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
    private readonly inquiriesService = inject(InquiriesService);
    private readonly blogsService = inject(BlogsService);
    private readonly realtime = inject(RealtimeService);
    readonly stats = signal<any>(null);
    readonly recentInquiries = signal<any[]>([]);
    readonly allFeedback = signal<any[]>([]);
    readonly recentBlogs = signal<any[]>([]);
    readonly draftBlogs = signal<any[]>([]);
    // ratingDist[0] = 5★ count … ratingDist[4] = 1★ count (descending for display)
    readonly ratingDist = signal<number[]>([0, 0, 0, 0, 0]);
    readonly avgRating = signal(0);
    private subs = new Subscription();

    ngOnInit() {
        this.loadStats();
        this.loadRatings();
        this.loadInquiries();
        this.loadBlogs();

        // Reload on relevant events
        this.subs.add(this.realtime.on<any>('inquiry:new').subscribe(() => {
            this.loadStats();
            this.loadInquiries();
            this.notif.fetchCounts();
        }));
        this.subs.add(this.realtime.on<any>('feedback:new').subscribe(() => {
            this.loadStats();
            this.loadRatings();
            this.notif.fetchCounts();
        }));
        this.subs.add(this.realtime.on<any>('feedback:approved').subscribe(() => {
            this.loadStats();
            this.loadRatings();
        }));
        this.subs.add(this.realtime.on<any>('feedback:deleted').subscribe(() => {
            this.loadStats();
            this.loadRatings();
        }));
        this.subs.add(this.realtime.on<any>('comment:new').subscribe(() => {
            this.loadStats();
            this.notif.fetchCounts();
        }));
        this.subs.add(this.realtime.on<any>('comment:approved').subscribe(() => this.loadStats()));
        this.subs.add(this.realtime.on<any>('comment:deleted').subscribe(() => this.loadStats()));
        this.subs.add(this.realtime.on<any>('inquiry:read').subscribe(() => this.loadStats()));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    private loadStats() {
        this.http.get(`${environment.apiUrl}/admin/dashboard`).subscribe({
            next: (data) => this.stats.set(data),
        });
    }

    private loadRatings() {
        this.feedbackService.getAll().subscribe({
            next: (data: any[]) => {
                this.allFeedback.set(data);
                const dist = [0, 0, 0, 0, 0];
                data.forEach(f => { if (f.rating >= 1 && f.rating <= 5) dist[5 - f.rating]++; });
                this.ratingDist.set(dist);
                if (data.length) {
                    const avg = data.reduce((s, f) => s + f.rating, 0) / data.length;
                    this.avgRating.set(Math.round(avg * 10) / 10);
                }
            },
        });
    }

    private loadInquiries() {
        this.inquiriesService.getAll().subscribe({
            next: (data: any[]) => this.recentInquiries.set(data.slice(0, 6)),
        });
    }

    private loadBlogs() {
        this.blogsService.getAllAdmin().subscribe({
            next: (data: any[]) => {
                const sorted = [...data].sort((a, b) =>
                    new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
                );
                this.recentBlogs.set(sorted.filter(b => b.isPublished).slice(0, 5));
                this.draftBlogs.set(sorted.filter(b => !b.isPublished).slice(0, 5));
            },
        });
    }

    approvalPct(total: number, pending: number): number {
        if (!total) return 100;
        return Math.round((total - pending) / total * 100);
    }

    ratingBarPct(count: number): number {
        const max = Math.max(...this.ratingDist(), 1);
        return Math.round(count / max * 100);
    }

    get activityFeed(): { id: string; icon: string; text: string; name: string; badge: string; badgeMod: string; time: string }[] {
        const inquiries = this.recentInquiries().map(i => ({
            id: 'inq-' + i.id,
            icon: 'bi-envelope',
            text: i.subject ?? i.message?.slice(0, 60) ?? '(no subject)',
            name: i.name,
            badge: i.status,
            badgeMod: i.status === 'new' ? '--danger' : '',
            time: i.createdAt,
        }));
        const feedback = this.allFeedback().map(f => ({
            id: 'fb-' + f.id,
            icon: 'bi-star',
            text: f.review?.slice(0, 60) ?? '(no review text)',
            name: f.name,
            badge: f.isApproved ? 'approved' : 'pending',
            badgeMod: f.isApproved ? '' : '--warn',
            time: f.createdAt,
        }));
        return [...inquiries, ...feedback]
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .slice(0, 8);
    }

    get pendingActions(): number {
        const s = this.stats();
        if (!s) return 0;
        return (s.comments.pending ?? 0) + (s.feedback.pending ?? 0) + (s.inquiries.new ?? 0);
    }

    get totalInteractions(): number {
        const s = this.stats();
        if (!s) return 0;
        return (s.inquiries.total ?? 0) + (s.feedback.total ?? 0) + (s.comments.total ?? 0);
    }
}
