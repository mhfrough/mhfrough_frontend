import {
    Component, OnInit, OnDestroy, inject, signal, effect,
    ViewChild, ElementRef, PLATFORM_ID,
} from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
    VisitorAnalyticsService, VisitorSession, VisitorStats,
    VisitorJourney, VisitorPageView, VisitorEvent,
} from '../../../../../core/services/visitor-analytics.service';
import { RealtimeService } from '../../../../../core/services/realtime.service';

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min

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
    private _chartRaw: { day: string; count: string }[] = [];
    private _chartW = 0;
    private _chartHoverSetup = false;

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

    // Journey expand state
    readonly expandedSessionId = signal<string | null>(null);
    readonly journeyLoading = signal(false);
    readonly journeyMap = signal<Record<string, VisitorJourney>>({});

    // Real-time current page per session: sessionId → path
    readonly currentPageMap = signal<Record<string, string>>({});

    // Expand top pages / top actions lists
    readonly showAllTopPages = signal(false);
    readonly showAllTopActions = signal(false);

    // Delete / clear confirm state
    readonly deleteSessionTargetId = signal<string | null>(null);
    readonly clearAllConfirm = signal(false);

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

        // Track which page each active visitor is currently on
        this.rtSubs.add(this.realtime.on<{ sessionId: string; path: string; timestamp: string }>('visitor:page_view').subscribe(ev => {
            this.currentPageMap.update(m => ({ ...m, [ev.sessionId]: ev.path }));
            // Update lastSeenAt in session list
            this.visitorSessions.update(list =>
                list.map(s => s.id === ev.sessionId ? { ...s, lastSeenAt: ev.timestamp } : s)
            );
        }));

        // Clear "Active now" when visitor leaves
        this.rtSubs.add(this.realtime.on<{ sessionId: string }>('visitor:left').subscribe(ev => {
            this.currentPageMap.update(m => { const n = { ...m }; delete n[ev.sessionId]; return n; });
            // Reset lastSeenAt so isActive() returns false immediately
            this.visitorSessions.update(list =>
                list.map(s => s.id === ev.sessionId ? { ...s, lastSeenAt: new Date(0).toISOString() } : s)
            );
        }));

        // Another admin tab wiped all data
        this.rtSubs.add(this.realtime.on<{}>('visitor:cleared').subscribe(() => {
            this.visitorSessions.set([]);
            this.visitorsTotal.set(0);
            this.visitorsTotalPages.set(1);
            this.visitorsPage.set(1);
            this.visitorStats.set(null);
            this.journeyMap.set({});
            this.expandedSessionId.set(null);
            this.currentPageMap.set({});
        }));

        // Append new events into cached journey data
        this.rtSubs.add(this.realtime.on<{ sessionId: string; eventName: string; path: string; metadata: Record<string, string>; timestamp: string }>('visitor:event').subscribe(ev => {
            const journey = this.journeyMap()[ev.sessionId];
            if (!journey) return;
            const newEvent: VisitorEvent = {
                id: `rt-${Date.now()}`,
                sessionId: ev.sessionId,
                eventName: ev.eventName,
                path: ev.path,
                metadata: ev.metadata,
                createdAt: ev.timestamp,
            };
            this.journeyMap.update(m => ({
                ...m,
                [ev.sessionId]: { ...journey, events: [...journey.events, newEvent] },
            }));
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

    toggleJourney(sessionId: string) {
        if (this.expandedSessionId() === sessionId) {
            this.expandedSessionId.set(null);
            return;
        }
        this.expandedSessionId.set(sessionId);
        if (this.journeyMap()[sessionId]) {
            this.renderJourneyChartForSession(sessionId);
            return;
        }
        this.journeyLoading.set(true);
        this.visitorService.getJourney(sessionId).subscribe({
            next: (j) => {
                this.journeyMap.update(m => ({ ...m, [sessionId]: j }));
                this.journeyLoading.set(false);
                setTimeout(() => this.renderJourneyChartForSession(sessionId));
            },
            error: () => this.journeyLoading.set(false),
        });
    }

    private renderJourneyChartForSession(_sessionId: string) {
        // no-op: Time per Page chart removed
    }

    isActive(session: VisitorSession): boolean {
        const ts = session.lastSeenAt ?? session.startedAt;
        return Date.now() - new Date(ts).getTime() < ACTIVE_THRESHOLD_MS;
    }

    currentPage(sessionId: string): string | null {
        return this.currentPageMap()[sessionId] ?? null;
    }

    journeyTimeline(journey: VisitorJourney): Array<{ type: 'page' | 'event'; time: string; label: string; sub?: string; icon: string; meta?: string; elapsed?: string }> {
        const items: Array<{ type: 'page' | 'event'; time: string; label: string; sub?: string; icon: string; meta?: string; elapsed?: string }> = [];

        for (const pv of journey.pageViews) {
            items.push({
                type: 'page',
                time: pv.createdAt,
                label: pv.path ?? '/',
                sub: pv.timeOnPageMs ? this.formatDuration(+pv.timeOnPageMs) : undefined,
                icon: 'bi-file-earmark-text',
            });
        }

        const sortedPageViews = [...journey.pageViews].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        for (const ev of journey.events) {
            const evTs = new Date(ev.createdAt).getTime();
            // Find the most recent page view that started before this event
            let elapsed: string | undefined;
            for (let i = sortedPageViews.length - 1; i >= 0; i--) {
                const pvTs = new Date(sortedPageViews[i].createdAt).getTime();
                if (pvTs <= evTs) {
                    const ms = evTs - pvTs;
                    elapsed = this.formatDuration(ms);
                    break;
                }
            }
            items.push({
                type: 'event',
                time: ev.createdAt,
                label: this.formatEventName(ev.eventName),
                sub: ev.path ?? undefined,
                icon: this.eventIcon(ev.eventName),
                elapsed: elapsed ? `+${elapsed}` : undefined,
                meta: ev.metadata ? Object.entries(ev.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ') : undefined,
            });
        }

        return items.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    }

    formatEventName(name: string): string {
        return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    eventIcon(name: string): string {
        if (name.includes('contact')) return 'bi-envelope';
        if (name.includes('project')) return 'bi-briefcase';
        if (name.includes('comment')) return 'bi-chat-text';
        if (name.includes('blog')) return 'bi-journal-text';
        if (name.includes('gallery')) return 'bi-images';
        if (name.includes('review') || name.includes('feedback') || name.includes('rating')) return 'bi-star';
        if (name.includes('cookie') || name.includes('consent')) return 'bi-shield-check';
        if (name.includes('nav')) return 'bi-cursor';
        return 'bi-lightning';
    }

    sessionEventsSummary(journey: VisitorJourney): { name: string; icon: string; count: number }[] {
        const counts = new Map<string, number>();
        for (const ev of journey.events) {
            counts.set(ev.eventName, (counts.get(ev.eventName) ?? 0) + 1);
        }
        return Array.from(counts.entries())
            .map(([name, count]) => ({ name, icon: this.eventIcon(name), count }))
            .sort((a, b) => b.count - a.count);
    }

    shortPath(path: string | null): string {
        if (!path) return '/';
        return path.length > 15 ? '…' + path.slice(-14) : path;
    }

    formatDuration(ms: number): string {
        if (!ms || ms < 1000) return '< 1s';
        const s = Math.floor(ms / 1000);
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}m`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h`;
        const d = Math.floor(h / 24);
        if (d < 30) return `${d}d`;
        const mo = Math.floor(d / 30);
        if (mo < 12) return `${mo}mo`;
        return `${Math.floor(mo / 12)}y`;
    }

    visitorDeviceIcon(type: string | null): string {
        switch (type) {
            case 'mobile': return 'bi-phone';
            case 'tablet': return 'bi-tablet';
            default: return 'bi-display';
        }
    }

    deviceDistPercent(deviceDist: { deviceType: string; count: string }[]): { label: string; pct: number; icon: string }[] {
        const total = deviceDist.reduce((s, d) => s + Number(d.count), 0) || 1;
        return deviceDist.map(d => ({
            label: d.deviceType,
            pct: Math.round((Number(d.count) / total) * 100),
            icon: this.visitorDeviceIcon(d.deviceType),
        }));
    }

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
        grad.addColorStop(0, 'rgba(228,224,216,0.18)');
        grad.addColorStop(1, 'rgba(228,224,216,0)');
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
        ctx.strokeStyle = '#e4e0d8';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        if (counts.length <= 15) {
            counts.forEach((v, i) => {
                ctx.beginPath();
                ctx.arc(getX(i), getY(v), 2.5, 0, Math.PI * 2);
                ctx.fillStyle = '#e4e0d8';
                ctx.fill();
            });
        }

        if (hoverIdx !== null) {
            const hx = getX(hoverIdx);
            const hy = getY(counts[hoverIdx]);

            ctx.save();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(228,224,216,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hx, padT);
            ctx.lineTo(hx, H - padB);
            ctx.stroke();
            ctx.restore();

            ctx.beginPath();
            ctx.arc(hx, hy, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(228,224,216,0.25)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(hx, hy, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#e4e0d8';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(hx, hy, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = '#1a1917';
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

            ctx.fillStyle = 'rgba(31,29,27,0.95)';
            ctx.strokeStyle = 'rgba(228,224,216,0.25)';
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
            ctx.fillStyle = '#e4e0d8';
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

    // ── Delete session ───────────────────────────────────────────────────────
    confirmDeleteSession(id: string) { this.deleteSessionTargetId.set(id); }
    cancelDeleteSession() { this.deleteSessionTargetId.set(null); }

    executeDeleteSession() {
        const id = this.deleteSessionTargetId();
        if (!id) return;
        this.visitorService.deleteSession(id).subscribe({
            next: () => {
                this.visitorSessions.update(list => list.filter(s => s.id !== id));
                this.visitorsTotal.update(n => n - 1);
                if (this.expandedSessionId() === id) this.expandedSessionId.set(null);
                this.deleteSessionTargetId.set(null);
            },
        });
    }

    // ── Clear all ────────────────────────────────────────────────────────────
    confirmClearAll() { this.clearAllConfirm.set(true); }
    cancelClearAll() { this.clearAllConfirm.set(false); }

    executeClearAll() {
        this.visitorService.clearAll().subscribe({
            next: () => {
                this.visitorSessions.set([]);
                this.visitorsTotal.set(0);
                this.visitorsTotalPages.set(1);
                this.visitorsPage.set(1);
                this.visitorStats.set(null);
                this.journeyMap.set({});
                this.expandedSessionId.set(null);
                this.currentPageMap.set({});
                this.clearAllConfirm.set(false);
            },
        });
    }

}
