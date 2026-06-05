import { Component, OnInit, OnDestroy, inject, signal, effect, ViewChild, ElementRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';
import { FeedbackService, InquiriesService } from '../../../core/services/inquiry-feedback.service';
import { BlogsService } from '../../../core/services/blogs.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { VisitorAnalyticsService, VisitorStats } from '../../../core/services/visitor-analytics.service';

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
    private readonly visitorService = inject(VisitorAnalyticsService);
    private readonly platformId = inject(PLATFORM_ID);

    @ViewChild('visitorChart') chartCanvas!: ElementRef<HTMLCanvasElement>;

    readonly stats = signal<any>(null);
    readonly recentInquiries = signal<any[]>([]);
    readonly allFeedback = signal<any[]>([]);
    readonly recentBlogs = signal<any[]>([]);
    readonly draftBlogs = signal<any[]>([]);
    // ratingDist[0] = 5★ count … ratingDist[4] = 1★ count (descending for display)
    readonly ratingDist = signal<number[]>([0, 0, 0, 0, 0]);
    readonly avgRating = signal(0);
    readonly visitorStats = signal<VisitorStats | null>(null);

    private subs = new Subscription();

    constructor() {
        effect(() => {
            const data = this.visitorStats()?.dailySessions;
            if (!data || data.length <= 1) return;
            if (!isPlatformBrowser(this.platformId)) return;
            const captured = data;
            setTimeout(() => {
                if (this.chartCanvas?.nativeElement) {
                    this.renderVisitorChart(captured);
                }
            });
        });
    }



    ngOnInit() {
        this.loadStats();
        this.loadRatings();
        this.loadInquiries();
        this.loadBlogs();
        this.loadVisitorStats();

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

        // inquiry deleted
        this.subs.add(this.realtime.on<{ id: string }>('inquiry:deleted').subscribe(() => {
            this.loadStats();
            this.loadInquiries();
        }));

        // feedback unapproved
        this.subs.add(this.realtime.on<any>('feedback:unapproved').subscribe(() => {
            this.loadStats();
            this.loadRatings();
        }));

        // project changes → refresh stats
        this.subs.add(this.realtime.on<any>('project:created').subscribe(() => this.loadStats()));
        this.subs.add(this.realtime.on<any>('project:updated').subscribe(() => this.loadStats()));
        this.subs.add(this.realtime.on<any>('project:deleted').subscribe(() => this.loadStats()));
        this.subs.add(this.realtime.on<any>('project:unpublished').subscribe(() => this.loadStats()));

        // new visitor session → refresh visitor stats
        this.subs.add(this.realtime.on<any>('visitor:session_created').subscribe(() => this.loadVisitorStats()));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    private renderVisitorChart(raw: { day: string; count: string }[]) {
        const canvas = this.chartCanvas.nativeElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = canvas.parentElement?.clientWidth ?? 400;
        const H = 100;
        canvas.width = W;
        canvas.height = H;

        const counts = raw.map(d => Number(d.count));
        const maxCount = Math.max(...counts, 1);
        const padT = 8, padB = 8;
        const chartH = H - padT - padB;

        ctx.clearRect(0, 0, W, H);

        const getX = (i: number) => (i / (counts.length - 1 || 1)) * W;
        const getY = (v: number) => padT + chartH - (v / maxCount) * chartH;

        // Area fill
        const grad = ctx.createLinearGradient(0, padT, 0, H);
        grad.addColorStop(0, 'rgba(99,102,241,0.28)');
        grad.addColorStop(1, 'rgba(99,102,241,0)');

        ctx.beginPath();
        ctx.moveTo(getX(0), getY(counts[0]));
        for (let i = 1; i < counts.length; i++) ctx.lineTo(getX(i), getY(counts[i]));
        ctx.lineTo(getX(counts.length - 1), H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Line
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(counts[0]));
        for (let i = 1; i < counts.length; i++) ctx.lineTo(getX(i), getY(counts[i]));
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    private loadStats() {
        this.http.get(`${environment.apiUrl}/admin/dashboard`).subscribe({
            next: (data) => this.stats.set(data),
        });
    }

    private loadVisitorStats() {
        this.visitorService.loadStats().subscribe({
            next: (data) => {
                this.visitorStats.set(data);
            },
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
            .slice(0, 6);
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

    visitorDeviceIcon(type: string | null): string {
        switch (type) {
            case 'mobile': return 'bi-phone';
            case 'tablet': return 'bi-tablet';
            default: return 'bi-display';
        }
    }

    visitorDevicePct(count: string): number {
        const total = this.visitorStats()?.total ?? 0;
        return total > 0 ? Math.round(Number(count) / total * 100) : 0;
    }
}
