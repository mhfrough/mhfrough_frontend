import { Component, OnInit, OnDestroy, inject, signal, effect, ViewChild, ElementRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { VisitorAnalyticsService, VisitorSession, VisitorStats } from '../../../../../core/services/visitor-analytics.service';
import { RealtimeService } from '../../../../../core/services/realtime.service';

@Component({
    selector: 'app-settings-visitors',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule],
    templateUrl: './settings-visitors.component.html',
})
export class SettingsVisitorsComponent implements OnInit, OnDestroy {
    private readonly visitorService = inject(VisitorAnalyticsService);
    private readonly realtime = inject(RealtimeService);
    private readonly platformId = inject(PLATFORM_ID);
    private rtSubs = new Subscription();

    @ViewChild('visitorChart') chartCanvas!: ElementRef<HTMLCanvasElement>;

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

    readonly visitorsLoading = signal(false);
    readonly visitorStats = signal<VisitorStats | null>(null);
    readonly visitorSessions = signal<VisitorSession[]>([]);
    readonly visitorsTotal = signal(0);
    readonly visitorsPage = signal(1);
    readonly visitorsLimit = signal(25);
    readonly visitorsTotalPages = signal(1);
    readonly visitorsSearch = signal('');

    get visitorsPageNumbers(): number[] {
        const total = this.visitorsTotalPages();
        const cur = this.visitorsPage();
        const pages: number[] = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i);
        return pages;
    }

    ngOnInit() {
        this.loadVisitors();

        this.rtSubs.add(this.realtime.on<VisitorSession>('visitor:session_created').subscribe(session => {
            if (this.visitorsPage() === 1) {
                this.visitorSessions.update(list => {
                    const updated = [session, ...list];
                    if (updated.length > this.visitorsLimit()) updated.pop();
                    return updated;
                });
                this.visitorsTotal.update(n => n + 1);
            }
        }));
    }

    ngOnDestroy() {
        this.rtSubs.unsubscribe();
    }

    loadVisitors() {
        this.visitorsLoading.set(true);
        this.visitorService.loadStats().subscribe({
            next: (s) => this.visitorStats.set(s),
            error: () => { },
        });
        this.fetchVisitorPage();
    }

    private fetchVisitorPage() {
        this.visitorsLoading.set(true);
        this.visitorService.list(this.visitorsPage(), this.visitorsLimit(), this.visitorsSearch() || undefined).subscribe({
            next: (res) => {
                this.visitorSessions.set(res.data);
                this.visitorsTotal.set(res.total);
                this.visitorsTotalPages.set(res.totalPages);
                this.visitorsLoading.set(false);
            },
            error: () => this.visitorsLoading.set(false),
        });
    }

    onVisitorsSearch(e: Event) {
        this.visitorsSearch.set((e.target as HTMLInputElement).value);
        this.visitorsPage.set(1);
        this.fetchVisitorPage();
    }

    onVisitorsPageSizeChange(e: Event) {
        this.visitorsLimit.set(+(e.target as HTMLSelectElement).value);
        this.visitorsPage.set(1);
        this.fetchVisitorPage();
    }

    visitorsGoToPage(page: number) {
        this.visitorsPage.set(page);
        this.fetchVisitorPage();
    }

    formatDuration(ms: number): string {
        if (!ms || ms < 1000) return '< 1s';
        const s = Math.floor(ms / 1000);
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        const rem = s % 60;
        return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
    }

    visitorDeviceIcon(type: string | null): string {
        switch (type) {
            case 'mobile': return 'bi-phone';
            case 'tablet': return 'bi-tablet';
            default: return 'bi-display';
        }
    }

    private renderVisitorChart(raw: { day: string; count: string }[]) {
        const canvas = this.chartCanvas.nativeElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = canvas.parentElement?.clientWidth ?? 400;
        const H = 110;
        canvas.width = W;
        canvas.height = H;

        const counts = raw.map(d => Number(d.count));
        const maxCount = Math.max(...counts, 1);
        const padT = 12, padB = 8, padL = 4, padR = 4;
        const chartH = H - padT - padB;

        ctx.clearRect(0, 0, W, H);

        const getX = (i: number) => padL + (i / (counts.length - 1 || 1)) * (W - padL - padR);
        const getY = (v: number) => padT + chartH - (v / maxCount) * chartH;

        // Grid lines
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

        // Area fill with smooth bezier
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

        // Smooth line
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

        // Data point dots (only when few data points to avoid clutter)
        if (counts.length <= 15) {
            counts.forEach((v, i) => {
                ctx.beginPath();
                ctx.arc(getX(i), getY(v), 2.5, 0, Math.PI * 2);
                ctx.fillStyle = '#818cf8';
                ctx.fill();
            });
        }
    }
}
