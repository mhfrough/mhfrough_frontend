import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { SeoApiService } from '../seo-api.service';
import { SeoAuditReport, Issue } from '../seo-report.types';
import { downloadText } from '../../tools/shared/clipboard.util';

interface SectionDef {
    key: string;
    label: string;
    icon: string;
}

interface ScoreTile {
    label: string;
    value: number;
}

interface CheckCategory {
    icon: string;
    title: string;
    body: string;
}

interface HowItWorksStep {
    num: string;
    title: string;
    body: string;
}

@Component({
    selector: 'app-seo-audit',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './seo-audit.component.html',
    styleUrl: './seo-audit.component.scss',
})
export class SeoAuditComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(SeoApiService);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    readonly url = signal('');
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly report = signal<SeoAuditReport | null>(null);

    /** Which collapsible sections are open. All open after a run. */
    readonly open = signal<Record<string, boolean>>({});

    readonly sections: SectionDef[] = [
        { key: 'technical', label: 'Technical SEO', icon: 'bi-gear' },
        { key: 'html', label: 'HTML Audit', icon: 'bi-filetype-html' },
        { key: 'headings', label: 'Headings', icon: 'bi-type-h1' },
        { key: 'images', label: 'Images', icon: 'bi-images' },
        { key: 'links', label: 'Links', icon: 'bi-link-45deg' },
        { key: 'performance', label: 'Performance', icon: 'bi-speedometer2' },
        { key: 'accessibility', label: 'Accessibility', icon: 'bi-universal-access' },
        { key: 'structuredData', label: 'Structured Data', icon: 'bi-diagram-3' },
        { key: 'social', label: 'Social Preview', icon: 'bi-share' },
        { key: 'content', label: 'Content Analysis', icon: 'bi-file-text' },
        { key: 'security', label: 'Security', icon: 'bi-shield-check' },
        { key: 'mobile', label: 'Mobile', icon: 'bi-phone' },
        { key: 'design', label: 'Fonts & Design', icon: 'bi-palette' },
        { key: 'technologies', label: 'Technologies', icon: 'bi-cpu' },
        { key: 'network', label: 'Domain & Network', icon: 'bi-hdd-network' },
        { key: 'buildHygiene', label: 'Build & Deploy Hygiene', icon: 'bi-box-seam' },
        { key: 'pwa', label: 'PWA Readiness', icon: 'bi-phone-vibrate' },
        { key: 'rendering', label: 'Rendering (SSR/Hydration)', icon: 'bi-braces-asterisk' },
        { key: 'libraries', label: 'Library Vulnerabilities', icon: 'bi-bug' },
    ];

    // --- Empty-state content (shown before the first run) ------------------

    readonly howItWorks: HowItWorksStep[] = [
        { num: '01', title: 'Paste a URL', body: 'Any public page — yours, a client’s, or a competitor’s.' },
        { num: '02', title: 'We crawl & analyse', body: '19 checks run in one pass: markup, performance proxies, security, domain health and more.' },
        { num: '03', title: 'Get a scored report', body: 'An overall score, every issue ranked by severity, and concrete before/after fixes.' },
    ];

    readonly checkCategories: CheckCategory[] = [
        { icon: 'bi-gear', title: 'Technical & Crawlability', body: 'robots.txt, sitemap.xml, canonical tags, redirect chains, indexability and HTTP status.' },
        { icon: 'bi-file-text', title: 'Content & On-Page', body: 'Titles, meta descriptions, heading hierarchy, readability and keyword usage.' },
        { icon: 'bi-speedometer2', title: 'Performance', body: 'Page weight, TTFB, render-blocking scripts/styles and compression.' },
        { icon: 'bi-universal-access', title: 'Accessibility & Mobile', body: 'Alt text, form labels, landmarks, viewport meta and responsive heuristics.' },
        { icon: 'bi-shield-check', title: 'Security', body: 'HTTPS, HSTS, CSP, cookie flags and SSL certificate expiry.' },
        { icon: 'bi-hdd-network', title: 'Domain & Network', body: 'DNS records, IP blacklist status and WHOIS registration expiry.' },
        { icon: 'bi-phone-vibrate', title: 'Modern Web', body: 'PWA manifest, service worker detection and SSR/hydration heuristics.' },
        { icon: 'bi-share', title: 'Social & Structured Data', body: 'Open Graph, Twitter Card previews and JSON-LD/microdata.' },
        { icon: 'bi-bug', title: 'Code Health', body: 'Exposed source maps or config files, and known-vulnerable client libraries.' },
    ];

    readonly scoreTiles = computed<ScoreTile[]>(() => {
        const r = this.report();
        if (!r) return [];
        const s = r.scores;
        return [
            { label: 'SEO', value: s.seo },
            { label: 'Performance', value: s.performance },
            { label: 'Accessibility', value: s.accessibility },
            { label: 'Security', value: s.security },
            { label: 'Best Practices', value: s.bestPractices },
            { label: 'Design', value: s.design },
            { label: 'Content', value: s.content },
            { label: 'Mobile', value: s.mobile },
        ];
    });

    readonly overallScore = computed(() => this.report()?.scores.overall ?? 0);

    /** Every section's issues flattened into one list, tagged with the section they came from. */
    readonly allIssues = computed<{ level: Issue['level']; msg: string; section: string }[]>(() => {
        const r = this.report();
        if (!r) return [];
        const out: { level: Issue['level']; msg: string; section: string }[] = [];
        for (const s of this.sections) {
            for (const i of this.sectionIssues(s.key)) out.push({ level: i.level, msg: i.msg, section: s.label });
        }
        return out;
    });

    readonly issueTotals = computed(() => {
        const all = this.allIssues();
        return {
            error: all.filter((i) => i.level === 'error').length,
            warn: all.filter((i) => i.level === 'warn').length,
            good: all.filter((i) => i.level === 'good').length,
        };
    });

    readonly issueFilter = signal<'all' | 'error' | 'warn'>('all');

    readonly filteredIssues = computed(() => {
        const f = this.issueFilter();
        return this.allIssues().filter((i) => (f === 'all' ? i.level !== 'good' : i.level === f));
    });

    readonly ogRows = computed(() => this.toRows(this.report()?.social?.og));
    readonly twitterRows = computed(() => this.toRows(this.report()?.social?.twitter));
    readonly previewImgFailed = signal(false);

    ngOnInit(): void {
        this.seo.update({
            title: 'SEO Audit Suite | Mohammad Hamza',
            description:
                'Free 16-section website audit: technical SEO, meta tags, headings, images, links, performance, accessibility, structured data, social previews, content, security, mobile, design tokens and tech detection — with scored results and prioritised fixes.',
            url: '/seo',
            keywords: 'seo audit, website audit, technical seo, meta tag checker, accessibility audit, security headers',
        });

        // Restore the last-audited URL from ?url= on load/reload (browser only —
        // avoid firing a real audit request during SSR).
        const qUrl = this.route.snapshot.queryParamMap.get('url');
        if (qUrl && isPlatformBrowser(this.platformId)) {
            this.url.set(qUrl);
            this.run();
        }
    }

    run(): void {
        const url = this.url().trim();
        if (!url) {
            this.error.set('Enter a page URL to audit.');
            return;
        }
        this.loading.set(true);
        this.error.set(null);
        this.report.set(null);
        this.previewImgFailed.set(false);

        if (isPlatformBrowser(this.platformId)) {
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { url },
                queryParamsHandling: 'merge',
                replaceUrl: true,
            });
        }

        this.api.audit(url).subscribe({
            next: (res) => {
                this.report.set(res);
                this.loading.set(false);
                this.issueFilter.set('all');
                // Open every section by default so the full report reads top-to-bottom.
                const all: Record<string, boolean> = {};
                for (const s of this.sections) all[s.key] = true;
                all['recommendations'] = true;
                this.open.set(all);
            },
            error: (err) => {
                this.loading.set(false);
                const msg = err?.error?.message;
                if (typeof msg === 'string') {
                    this.error.set(msg);
                } else if (Array.isArray(msg)) {
                    this.error.set(msg.join(' '));
                } else if (!err?.status || err.status >= 500) {
                    // Network failure / gateway error — the audit API itself is down,
                    // not the URL being audited (e.g. Render dyno still waking up).
                    this.error.set('The audit service is unreachable right now — it may still be waking up. Try again in ~30 seconds.');
                } else {
                    this.error.set("Couldn't reach that URL. Check the address and try again.");
                }
            },
        });
    }

    toggle(key: string): void {
        this.open.update((o) => ({ ...o, [key]: !o[key] }));
    }

    isOpen(key: string): boolean {
        return this.open()[key] !== false && this.open()[key] !== undefined;
    }

    /** Lighthouse-style banding: 90+ good, 50–89 average, below 50 poor. */
    scoreClass(n: number): string {
        if (n >= 90) return 'is-good';
        if (n >= 50) return 'is-mid';
        return 'is-poor';
    }

    issueCounts(issues: Issue[] | undefined): { good: number; warn: number; error: number } {
        const c = { good: 0, warn: 0, error: 0 };
        for (const i of issues ?? []) c[i.level] += 1;
        return c;
    }

    sectionIssues(key: string): Issue[] {
        const r = this.report() as unknown as Record<string, { issues?: Issue[] }> | null;
        if (!r) return [];
        return r[key]?.issues ?? [];
    }

    kb(bytes: number): string {
        return `${Math.round(bytes / 1024)} KB`;
    }

    exposedCount(files: { exposed: boolean }[]): number {
        return files.filter((f) => f.exposed).length;
    }

    pwaFieldRows(fields: Record<string, boolean>): { key: string; ok: boolean }[] {
        return Object.entries(fields).map(([key, ok]) => ({ key, ok }));
    }

    renderModeLabel(mode: string): string {
        switch (mode) {
            case 'ssr': return 'SSR';
            case 'csr-shell': return 'CSR shell';
            case 'static': return 'Static';
            default: return 'Unknown';
        }
    }

    // --- Exports ---------------------------------------------------------------

    exportJson(): void {
        const r = this.report();
        if (!r || !isPlatformBrowser(this.platformId)) return;
        downloadText(JSON.stringify(r, null, 2), 'seo-audit-report.json', 'application/json');
    }

    exportCsv(): void {
        const r = this.report();
        if (!r || !isPlatformBrowser(this.platformId)) return;
        const rows: string[][] = [['section', 'level', 'message']];
        for (const s of this.sections) {
            for (const i of this.sectionIssues(s.key)) rows.push([s.label, i.level, i.msg]);
        }
        for (const rec of r.recommendations) {
            rows.push(['Recommendation', rec.level, `[P${rec.priority}] ${rec.title} — ${rec.explanation}`]);
        }
        const csv = rows
            .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
            .join('\r\n');
        downloadText(csv, 'seo-audit-report.csv', 'text/csv');
    }

    exportHtml(): void {
        const r = this.report();
        if (!r || !isPlatformBrowser(this.platformId)) return;
        const e = this.escapeHtml;
        const scoreRows = [{ label: 'Overall', value: r.scores.overall }, ...this.scoreTiles()]
            .map((t) => `<tr><td>${e(t.label)}</td><td>${t.value}</td></tr>`)
            .join('');
        const issueRows = this.sections
            .flatMap((s) => this.sectionIssues(s.key).map((i) => `<tr><td>${e(s.label)}</td><td>${e(i.level)}</td><td>${e(i.msg)}</td></tr>`))
            .join('');
        const recBlocks = r.recommendations
            .map((rec) => `<div class="rec"><h3>[P${rec.priority}] ${e(rec.title)} <small>(${e(rec.category)} · ${e(rec.seoImpact)} impact · ${e(rec.difficulty)} · ${e(rec.estimatedFixTime)})</small></h3><p>${e(rec.explanation)}</p><p><em>${e(rec.whyItMatters)}</em></p>${rec.codeBefore ? `<pre>${e(rec.codeBefore)}</pre>` : ''}${rec.codeAfter ? `<pre>${e(rec.codeAfter)}</pre>` : ''}</div>`)
            .join('');
        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SEO Audit — ${e(r.finalUrl)}</title><style>body{font-family:monospace;background:#1a1917;color:#e4e0d8;max-width:900px;margin:2rem auto;padding:0 1rem}table{border-collapse:collapse;width:100%;margin:1rem 0}td,th{border:1px solid #444;padding:.4rem .6rem;text-align:left}pre{background:#242220;padding:.75rem;overflow-x:auto}h1,h2{border-bottom:1px solid #444;padding-bottom:.3rem}.rec{margin:1.5rem 0}</style></head><body><h1>SEO Audit Report</h1><p>URL: ${e(r.finalUrl)}<br>Fetched: ${e(r.fetchedAt)}<br>Duration: ${r.durationMs}ms</p><h2>Scores</h2><table>${scoreRows}</table><h2>Issues</h2><table><tr><th>Section</th><th>Level</th><th>Message</th></tr>${issueRows}</table><h2>Recommendations</h2>${recBlocks}</body></html>`;
        downloadText(html, 'seo-audit-report.html', 'text/html');
    }

    print(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        window.print();
    }

    /** Escape untrusted remote-page strings before concatenating into export HTML. */
    private readonly escapeHtml = (s: string): string =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    private toRows(map: Record<string, string> | undefined): { key: string; value: string }[] {
        if (!map) return [];
        return Object.entries(map).map(([key, value]) => ({ key, value }));
    }
}
