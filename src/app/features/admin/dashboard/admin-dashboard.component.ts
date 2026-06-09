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
import { AppointmentsService, Appointment } from '../../../core/services/appointments.service';

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
    private readonly appointmentsService = inject(AppointmentsService);
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
    readonly todayReminders = signal<Appointment[]>([]);

    private subs = new Subscription();
    private _chartRaw: { day: string; count: string }[] = [];
    private _chartW = 0;
    private _chartHoverSetup = false;

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
        this.loadTodayReminders();

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

        // reminder changes → refresh today's reminders
        this.subs.add(this.realtime.on<any>('reminder:created').subscribe(() => this.loadTodayReminders()));
        this.subs.add(this.realtime.on<any>('reminder:updated').subscribe(() => this.loadTodayReminders()));
        this.subs.add(this.realtime.on<any>('reminder:deleted').subscribe(() => this.loadTodayReminders()));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    private renderVisitorChart(raw: { day: string; count: string }[]) {
        const canvas = this.chartCanvas.nativeElement;
        this._chartRaw = raw;
        this._chartW = canvas.parentElement?.clientWidth ?? 400;
        canvas.width = this._chartW;
        canvas.height = 110;
        this._drawVisitorChart(null);
        this._setupChartHover();
    }

    private _drawVisitorChart(hoverIdx: number | null) {
        const canvas = this.chartCanvas.nativeElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const raw = this._chartRaw;
        const W = this._chartW || canvas.width;
        const H = 110;
        const counts = raw.map(d => Number(d.count));
        const maxCount = Math.max(...counts, 1);
        const padT = 12, padB = 8, padL = 4, padR = 4;
        const chartH = H - padT - padB;

        ctx.clearRect(0, 0, W, H);

        const getX = (i: number) => padL + (i / (counts.length - 1 || 1)) * (W - padL - padR);
        const getY = (v: number) => padT + chartH - (v / maxCount) * chartH;

        const gridLines = 4;
        ctx.strokeStyle = 'rgba(228,224,216,0.06)';
        ctx.lineWidth = 1;
        for (let g = 0; g <= gridLines; g++) {
            const y = padT + (g / gridLines) * chartH;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(W - padR, y);
            ctx.stroke();
        }

        const grad = ctx.createLinearGradient(0, padT, 0, H);
        grad.addColorStop(0, 'rgba(99,102,241,0.25)');
        grad.addColorStop(1, 'rgba(99,102,241,0)');
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(counts[0]));
        for (let i = 1; i < counts.length; i++) {
            const cpx = (getX(i - 1) + getX(i)) / 2;
            ctx.bezierCurveTo(cpx, getY(counts[i - 1]), cpx, getY(counts[i]), getX(i), getY(counts[i]));
        }
        ctx.lineTo(getX(counts.length - 1), H - padB);
        ctx.lineTo(getX(0), H - padB);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(getX(0), getY(counts[0]));
        for (let i = 1; i < counts.length; i++) {
            const cpx = (getX(i - 1) + getX(i)) / 2;
            ctx.bezierCurveTo(cpx, getY(counts[i - 1]), cpx, getY(counts[i]), getX(i), getY(counts[i]));
        }
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        if (counts.length <= 15) {
            counts.forEach((v, i) => {
                ctx.beginPath();
                ctx.arc(getX(i), getY(v), 2.5, 0, Math.PI * 2);
                ctx.fillStyle = '#818cf8';
                ctx.fill();
            });
        }

        if (hoverIdx !== null) {
            const hx = getX(hoverIdx);
            const hy = getY(counts[hoverIdx]);

            ctx.save();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(129,140,248,0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hx, padT);
            ctx.lineTo(hx, H - padB);
            ctx.stroke();
            ctx.restore();

            ctx.beginPath();
            ctx.arc(hx, hy, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(129,140,248,0.3)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(hx, hy, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#818cf8';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(hx, hy, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = '#e0e7ff';
            ctx.fill();

            const date = new Date(raw[hoverIdx].day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const text = `${date}  ${counts[hoverIdx]}`;
            ctx.font = '10px monospace';
            const tw = ctx.measureText(text).width + 14;
            const th = 18;
            let tx = hx - tw / 2;
            if (tx < 2) tx = 2;
            if (tx + tw > W - 2) tx = W - tw - 2;
            const ty = padT - 2;

            ctx.fillStyle = 'rgba(15,12,41,0.92)';
            ctx.strokeStyle = 'rgba(129,140,248,0.4)';
            ctx.lineWidth = 1;
            if ((ctx as any).roundRect) {
                ctx.beginPath();
                (ctx as any).roundRect(tx, ty, tw, th, 3);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.fillRect(tx, ty, tw, th);
                ctx.strokeRect(tx, ty, tw, th);
            }
            ctx.fillStyle = '#c7d2fe';
            ctx.fillText(text, tx + 7, ty + 12);
        }
    }

    private _setupChartHover() {
        if (this._chartHoverSetup) return;
        this._chartHoverSetup = true;
        const canvas = this.chartCanvas.nativeElement;
        const padL = 4, padR = 4;

        canvas.addEventListener('mousemove', (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
            const n = this._chartRaw.length;
            const W = this._chartW;
            const getX = (i: number) => padL + (i / (n - 1 || 1)) * (W - padL - padR);
            let closest = 0, minDist = Infinity;
            for (let i = 0; i < n; i++) {
                const dist = Math.abs(getX(i) - mx);
                if (dist < minDist) { minDist = dist; closest = i; }
            }
            this._drawVisitorChart(closest);
        });

        canvas.addEventListener('mouseleave', () => this._drawVisitorChart(null));
    }

    private loadTodayReminders() {
        const today = new Date().toISOString().slice(0, 10);
        this.appointmentsService.getAll().subscribe({
            next: (data) => {
                const todays = data
                    .filter(a => a.date === today && a.status !== 'cancelled')
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
                this.todayReminders.set(todays);
            },
        });
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
            badgeMod: i.status === 'new' ? '--danger' : '--on',
            time: i.createdAt,
        }));
        const feedback = this.allFeedback().map(f => ({
            id: 'fb-' + f.id,
            icon: 'bi-star',
            text: f.review?.slice(0, 60) ?? '(no review text)',
            name: f.name,
            badge: f.isApproved ? 'approved' : 'pending',
            badgeMod: f.isApproved ? '--on' : '--warn',
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
