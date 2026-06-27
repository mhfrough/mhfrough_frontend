import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { AdminAnalyticsService, AnalyticsOverview } from '../../../../../core/services/admin-analytics.service';

interface SeriesCard {
    key: string;
    label: string;
    icon: string;
    values: number[];
    days: string[];
    money: boolean;
}

const LEAD_STAGES: { key: string; label: string; accent: string }[] = [
    { key: 'new', label: 'New', accent: 'var(--pipeline-new)' },
    { key: 'contacted', label: 'Contacted', accent: 'var(--pipeline-contacted)' },
    { key: 'qualified', label: 'Qualified', accent: 'var(--pipeline-qualified)' },
    { key: 'quoted', label: 'Quoted', accent: 'var(--pipeline-quoted)' },
    { key: 'won', label: 'Won', accent: 'var(--pipeline-won)' },
    { key: 'lost', label: 'Lost', accent: 'var(--pipeline-lost)' },
];

@Component({
    selector: 'app-settings-analytics',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './settings-analytics.component.html',
    styleUrl: './settings-analytics.component.scss',
})
export class SettingsAnalyticsComponent implements OnInit {
    private readonly svc = inject(AdminAnalyticsService);
    private readonly platformId = inject(PLATFORM_ID);

    // SVG viewBox geometry (preserveAspectRatio="none" stretches to the card).
    readonly VW = 320;
    readonly VH = 80;
    readonly PAD = 6;

    readonly loading = signal(true);
    readonly error = signal('');
    readonly data = signal<AnalyticsOverview | null>(null);
    readonly days = signal(30);

    readonly ranges = [7, 30, 90, 180];
    readonly leadStages = LEAD_STAGES;
    readonly ratings = [5, 4, 3, 2, 1];

    readonly cards = computed<SeriesCard[]>(() => {
        const d = this.data();
        if (!d) return [];
        const days = d.series.inquiries.map(p => p.day);
        return [
            { key: 'inquiries', label: 'Inquiries', icon: 'bi-envelope', values: d.series.inquiries.map(p => p.count), days, money: false },
            { key: 'leads', label: 'Leads', icon: 'bi-funnel', values: d.series.leads.map(p => p.count), days, money: false },
            { key: 'feedback', label: 'Feedback', icon: 'bi-star', values: d.series.feedback.map(p => p.count), days, money: false },
            { key: 'comments', label: 'Comments', icon: 'bi-chat-left-text', values: d.series.comments.map(p => p.count), days, money: false },
            { key: 'revenue', label: 'Revenue (paid)', icon: 'bi-cash-coin', values: d.series.revenue.map(p => p.amount), days, money: true },
        ];
    });

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.error.set('');
        this.svc.overview(this.days()).subscribe({
            next: d => { this.data.set(d); this.loading.set(false); },
            error: () => { this.error.set('Could not load analytics.'); this.loading.set(false); },
        });
    }

    setDays(n: number): void {
        if (n === this.days()) return;
        this.days.set(n);
        this.load();
    }

    // ── Aggregates for the template ───────────────────────────────────────────
    sum(values: number[]): number {
        return values.reduce((a, b) => a + b, 0);
    }

    leadStageCount(key: string): number {
        return this.data()?.leadsByStatus?.[key] ?? 0;
    }

    leadStageTotal(): number {
        const s = this.data()?.leadsByStatus ?? {};
        return Object.values(s).reduce((a, b) => a + b, 0);
    }

    leadStagePct(key: string): number {
        const total = this.leadStageTotal();
        return total ? Math.round((this.leadStageCount(key) / total) * 100) : 0;
    }

    ratingCount(r: number): number {
        return this.data()?.feedbackByRating?.[String(r)] ?? 0;
    }

    ratingPct(r: number): number {
        const dist = this.data()?.feedbackByRating ?? {};
        const max = Math.max(...Object.values(dist).map(Number), 1);
        return Math.round((this.ratingCount(r) / max) * 100);
    }

    // ── SVG chart path builders (no canvas → SSR-safe, theme via currentColor) ──
    private coords(values: number[]): { x: number; y: number }[] {
        const n = values.length;
        const max = Math.max(...values, 1);
        const innerW = this.VW - this.PAD * 2;
        const innerH = this.VH - this.PAD * 2;
        return values.map((v, i) => ({
            x: this.PAD + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW),
            y: this.PAD + innerH - (v / max) * innerH,
        }));
    }

    linePath(values: number[]): string {
        const pts = this.coords(values);
        if (!pts.length) return '';
        return 'M' + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
    }

    areaPath(values: number[]): string {
        const pts = this.coords(values);
        if (!pts.length) return '';
        const base = (this.VH - this.PAD).toFixed(1);
        const inner = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
        return `M${pts[0].x.toFixed(1)},${base} L${inner} L${pts[pts.length - 1].x.toFixed(1)},${base} Z`;
    }

    // ── CSV export ────────────────────────────────────────────────────────────
    exportCsv(): void {
        const d = this.data();
        if (!d || !isPlatformBrowser(this.platformId)) return;
        const days = d.series.inquiries.map(p => p.day);
        const rows: string[][] = [['date', 'inquiries', 'leads', 'feedback', 'comments', 'revenue']];
        days.forEach((day, i) => rows.push([
            day,
            String(d.series.inquiries[i].count),
            String(d.series.leads[i].count),
            String(d.series.feedback[i].count),
            String(d.series.comments[i].count),
            String(d.series.revenue[i].amount),
        ]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${d.range.days}d.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
