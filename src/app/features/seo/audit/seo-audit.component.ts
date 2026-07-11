import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { SeoApiService } from '../seo-api.service';
import { SeoAuditReport, Issue } from '../seo-report.types';
import { copyText, downloadText } from '../../tools/shared/clipboard.util';

interface SectionDef {
    key: string;
    label: string;
    icon: string;
    /** "What this checks & why it matters" — shown in the ?-icon tooltip. */
    info: string;
}

interface ScoreTile {
    label: string;
    value: number;
    info: string;
}

interface LoaderStage {
    icon: string;
    label: string;
    /** Elapsed seconds after which this stage is considered done (client-side estimate). */
    doneAt: number;
}

/** Shape of the last-report cache entry kept in localStorage. */
interface StoredReport {
    savedAt: string;
    url: string;
    keyword: string;
    report: SeoAuditReport;
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
export class SeoAuditComponent implements OnInit, OnDestroy {
    private readonly seo = inject(SeoService);
    private readonly api = inject(SeoApiService);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    readonly url = signal('');
    readonly keyword = signal('');
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly report = signal<SeoAuditReport | null>(null);
    readonly shareCopied = signal(false);
    /** Stored runs (oldest → newest) of the currently audited URL — feeds the trend chart. */
    readonly historyRuns = signal<{ at: string; overall: number }[]>([]);
    /** Overall-score change vs the previous stored run of the same URL (null = first run). */
    readonly scoreDelta = computed<number | null>(() => {
        const runs = this.historyRuns();
        return runs.length >= 2 ? runs[runs.length - 1].overall - runs[runs.length - 2].overall : null;
    });
    /** fetchedAt of a report restored from localStorage (null = fresh from the API). */
    readonly restoredAt = signal<string | null>(null);

    /** Which collapsible sections are open. All open after a run. */
    readonly open = signal<Record<string, boolean>>({});

    readonly sections: SectionDef[] = [
        { key: 'keyword', label: 'Keyword Analysis', icon: 'bi-bullseye', info: 'Where your target keyword appears — title, description, H1, first paragraph, URL, image alts. Placement tells search engines exactly what the page should rank for.' },
        { key: 'technical', label: 'Technical SEO', icon: 'bi-gear', info: 'Crawlability fundamentals: HTTP status, HTTPS, canonical, robots.txt, sitemap and redirects. If crawlers can\'t fetch and index the page cleanly, nothing else in this report matters.' },
        { key: 'html', label: 'HTML Audit', icon: 'bi-filetype-html', info: 'The head tags Google reads first. Title and meta description are your search-result headline and ad copy — missing or duplicate tags waste clicks.' },
        { key: 'headings', label: 'Headings', icon: 'bi-type-h1', info: 'The H1–H6 outline. One clear H1 and an unbroken hierarchy help search engines and screen readers understand how the page is organised.' },
        { key: 'images', label: 'Images', icon: 'bi-images', info: 'Alt text, dimensions, lazy loading, modern formats and broken files. Images are usually the heaviest part of a page and the most common accessibility gap.' },
        { key: 'links', label: 'Links', icon: 'bi-link-45deg', info: 'Internal/external mix, anchor quality and broken links. Broken links leak authority and crawl budget; generic anchors like "click here" tell Google nothing.' },
        { key: 'performance', label: 'Performance', icon: 'bi-speedometer2', info: 'Page weight, time-to-first-byte and render-blocking assets. Speed is a confirmed ranking signal — and slow pages lose visitors before they even load.' },
        { key: 'accessibility', label: 'Accessibility', icon: 'bi-universal-access', info: 'Alt text, form labels, landmarks and page language. Accessible pages reach more people, avoid legal risk and overlap heavily with good SEO.' },
        { key: 'structuredData', label: 'Structured Data', icon: 'bi-diagram-3', info: 'JSON-LD and microdata markup. Structured data unlocks rich results — stars, FAQs, breadcrumbs — that earn more clicks from the same ranking.' },
        { key: 'social', label: 'Social Preview', icon: 'bi-share', info: 'Open Graph and Twitter Card tags. These control the title, image and text shown when the page is shared — a broken card means the link gets scrolled past.' },
        { key: 'content', label: 'Content Analysis', icon: 'bi-file-text', info: 'Word count, readability, keyword usage and text-to-HTML ratio. Thin or hard-to-read content rarely ranks, however clean the markup is.' },
        { key: 'security', label: 'Security', icon: 'bi-shield-check', info: 'HTTPS, HSTS, CSP and cookie flags. Browsers warn users away from insecure pages, and most of these headers are one-line fixes that protect visitors.' },
        { key: 'mobile', label: 'Mobile', icon: 'bi-phone', info: 'Viewport meta, media queries and base font size. Google indexes the mobile version of your page first — if it fails on a phone, it fails.' },
        { key: 'design', label: 'Fonts & Design', icon: 'bi-palette', info: 'Colours, fonts and design tokens extracted from the live CSS — an instant style-guide snapshot of how consistent the site\'s design system is.' },
        { key: 'technologies', label: 'Technologies', icon: 'bi-cpu', info: 'Frameworks, CMS, analytics and infrastructure fingerprinted from the page — know exactly what a site is built with.' },
        { key: 'hosting', label: 'Hosting & Infrastructure', icon: 'bi-hdd-rack', info: 'Hosting provider, CDN, DNS provider and server location. Infrastructure choices set your latency floor before a single line of code runs.' },
        { key: 'marketing', label: 'Marketing & Analytics', icon: 'bi-megaphone', info: 'Analytics tags, share-card completeness, email capture and contact channels — whether the page can measure and convert the traffic it earns.' },
        { key: 'network', label: 'Domain & Network', icon: 'bi-hdd-network', info: 'DNS records, spam blacklists, SPF/DMARC and domain expiry. Domain-level problems can silently kill email deliverability — or take the whole site offline.' },
        { key: 'buildHygiene', label: 'Build & Deploy Hygiene', icon: 'bi-box-seam', info: 'Exposed source maps, dot-files and debug leftovers. These leak source code, secrets and internal paths to anyone who thinks to look.' },
        { key: 'pwa', label: 'PWA Readiness', icon: 'bi-phone-vibrate', info: 'Web-app manifest, icons and service worker. PWA basics make the site installable, faster on repeat visits and resilient when the connection drops.' },
        { key: 'rendering', label: 'Rendering (SSR/Hydration)', icon: 'bi-braces-asterisk', info: 'Whether meaningful HTML arrives from the server or is assembled by JavaScript in the browser. Empty shells make indexing slower and riskier.' },
        { key: 'libraries', label: 'Library Vulnerabilities', icon: 'bi-bug', info: 'Client-side libraries with known CVEs, fingerprinted from script URLs. One outdated jQuery can expose every visitor to cross-site scripting.' },
        { key: 'responsive', label: 'Responsive Breakpoints', icon: 'bi-window-split', info: 'Real Chromium screenshots at seven widths from 320px to 1920px, plus overflow detection — proof of what visitors actually see on each device.' },
        { key: 'browserCompat', label: 'Browser Support', icon: 'bi-browser-chrome', info: 'Modern CSS features and prefix-only properties that may break in older browsers — silent layout failures you\'d never notice in latest Chrome.' },
        { key: 'errorPage', label: 'Error Page (404)', icon: 'bi-signpost-split', info: 'What a bad URL returns. Soft-404s (HTTP 200 for missing pages) confuse crawlers; a designed 404 page keeps lost visitors on the site.' },
        { key: 'socialPresence', label: 'Social & Brand Presence', icon: 'bi-people', info: 'Social profiles linked from the page, username availability across platforms and alternative domains — brand protection worth claiming early.' },
    ];

    // --- Card info texts (?-icon tooltips) ---------------------------------

    readonly overallInfo = 'Weighted blend of all eight category scores, Lighthouse-style: 90+ is good, 50–89 needs work, under 50 is poor. Fix critical issues first — they drag this number the most.';
    readonly headlineInfo = {
        error: 'Failed checks that actively hurt ranking, security or usability — fix these first.',
        warn: 'Passable but costing you something — each warning is a small ranking, speed or trust leak.',
        good: 'Checks the page already passes. Keep them green between releases.',
    };
    readonly recommendationsInfo = 'Every issue turned into a concrete, prioritised fix — sorted so the first item is the highest impact for the least effort, with before/after code where it helps.';
    readonly trendInfo = 'Your overall score across previous runs of this URL, stored in this browser. Re-audit after each fix to watch it climb.';
    readonly donutInfo = 'How all checks split between critical failures, warnings and passes. The bigger the green share, the healthier the page.';
    readonly barsInfo = 'Sections ranked by how many problems they contain — start at the top bar and work down for the fastest score gain.';

    // --- Empty-state content (shown before the first run) ------------------

    readonly howItWorks: HowItWorksStep[] = [
        { num: '01', title: 'Paste a URL', body: 'Any public page — yours, a client’s, or a competitor’s.' },
        { num: '02', title: 'We crawl & analyse', body: '26 checks run in one pass — markup, performance proxies, security, domain health, plus a real headless-browser render at seven screen sizes, from a 320px phone to a 1920px desktop. Add a target keyword for on-page placement analysis.' },
        { num: '03', title: 'Get a scored report', body: 'An overall score, every issue ranked by severity, and concrete before/after fixes. The report is saved in your browser, so it survives a reload — re-run anytime for a fresh one.' },
    ];

    readonly checkCategories: CheckCategory[] = [
        { icon: 'bi-gear', title: 'Technical & Crawlability', body: 'robots.txt, sitemap.xml, canonical tags, redirect chains, indexability and HTTP status.' },
        { icon: 'bi-file-text', title: 'Content & On-Page', body: 'Titles, meta descriptions, heading hierarchy, readability, text-to-HTML ratio and target-keyword placement.' },
        { icon: 'bi-speedometer2', title: 'Performance', body: 'Page weight, TTFB, render-blocking scripts/styles and compression.' },
        { icon: 'bi-universal-access', title: 'Accessibility & Mobile', body: 'Alt text, form labels, landmarks, viewport meta and responsive heuristics.' },
        { icon: 'bi-shield-check', title: 'Security', body: 'HTTPS, HSTS, CSP, cookie flags and SSL certificate expiry.' },
        { icon: 'bi-hdd-network', title: 'Domain & Network', body: 'DNS records, IP blacklist status and WHOIS registration expiry.' },
        { icon: 'bi-phone-vibrate', title: 'Modern Web', body: 'PWA manifest, service worker detection and SSR/hydration heuristics.' },
        { icon: 'bi-share', title: 'Social & Structured Data', body: 'Open Graph, Twitter Card previews and JSON-LD/microdata.' },
        { icon: 'bi-bug', title: 'Code Health', body: 'Exposed source maps or config files, and known-vulnerable client libraries.' },
        { icon: 'bi-window-split', title: 'Responsive & Browsers', body: 'Real Chromium render at phone, tablet and desktop widths with screenshots, overflow detection, console errors and CSS browser-support risks.' },
        { icon: 'bi-people', title: 'Brand Presence', body: 'Social profiles linked from the page, unclaimed usernames on major platforms, alternative-TLD domain availability and a 404-page quality check.' },
    ];

    /** Sections actually present in this report (keyword section is opt-in). */
    readonly visibleSections = computed<SectionDef[]>(() => {
        const r = this.report();
        return this.sections.filter((s) => s.key !== 'keyword' || !!r?.keyword);
    });

    /** Google-style SERP snippet data derived from the audited page's tags. */
    readonly serp = computed(() => {
        const r = this.report();
        if (!r) return null;
        let breadcrumb = r.finalUrl;
        try {
            const u = new URL(r.finalUrl);
            const parts = u.pathname.split('/').filter(Boolean);
            breadcrumb = u.hostname + (parts.length ? ' › ' + parts.join(' › ') : '');
        } catch { /* keep raw url */ }
        const clip = (s: string | null, max: number): string => {
            if (!s) return '';
            return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
        };
        return {
            breadcrumb,
            title: clip(r.html.title, 60) || r.finalUrl,
            description: clip(r.html.description, 160) || 'No meta description — Google will improvise a snippet from page content.',
            titleTruncated: (r.html.title?.length ?? 0) > 60,
            descTruncated: (r.html.description?.length ?? 0) > 160,
        };
    });

    readonly scoreTiles = computed<ScoreTile[]>(() => {
        const r = this.report();
        if (!r) return [];
        const s = r.scores;
        return [
            { label: 'SEO', value: s.seo, info: 'Crawlability, meta tags, headings, links and structured data combined — how findable and understandable the page is to search engines.' },
            { label: 'Performance', value: s.performance, info: 'Page weight, time-to-first-byte and render-blocking resources. Slower pages rank lower and convert worse.' },
            { label: 'Accessibility', value: s.accessibility, info: 'Alt text, form labels, landmarks and language checks — how usable the page is for everyone, including screen-reader users.' },
            { label: 'Security', value: s.security, info: 'HTTPS plus the protective headers and cookie flags that keep visitors safe and browsers from flagging the site.' },
            { label: 'Best Practices', value: s.bestPractices, info: 'Build hygiene, deprecated markup, error handling and modern-web standards — signs of a well-maintained site.' },
            { label: 'Design', value: s.design, info: 'Consistency of the design system: tokens, fonts and dark-mode support extracted from the live CSS.' },
            { label: 'Content', value: s.content, info: 'Amount, readability and structure of the actual text — the thing visitors and search engines came for.' },
            { label: 'Mobile', value: s.mobile, info: 'Viewport setup, responsive CSS and font sizing on small screens, where most search traffic starts.' },
        ];
    });

    readonly overallScore = computed(() => this.report()?.scores.overall ?? 0);

    /** Every section's issues flattened into one list, tagged with the section they came from. */
    readonly allIssues = computed<{ level: Issue['level']; msg: string; section: string }[]>(() => {
        const r = this.report();
        if (!r) return [];
        const out: { level: Issue['level']; msg: string; section: string }[] = [];
        for (const s of this.visibleSections()) {
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

    // --- Loading experience --------------------------------------------------

    /** Audit phases shown while the single long API call runs. The backend reports
     *  nothing until it finishes, so stage timing is a client-side estimate. */
    readonly loaderStages: LoaderStage[] = [
        { icon: 'bi-globe2', label: 'Resolving DNS & fetching the page', doneAt: 3 },
        { icon: 'bi-filetype-html', label: 'Parsing HTML, meta tags & headings', doneAt: 6 },
        { icon: 'bi-images', label: 'Checking images, links & resources', doneAt: 10 },
        { icon: 'bi-signpost-split', label: 'Probing robots.txt, sitemap & 404 handling', doneAt: 13 },
        { icon: 'bi-shield-check', label: 'Inspecting SSL, security headers & cookies', doneAt: 16 },
        { icon: 'bi-hdd-network', label: 'Querying DNS, WHOIS & spam blacklists', doneAt: 20 },
        { icon: 'bi-window-split', label: 'Rendering in Chromium at seven screen sizes', doneAt: 32 },
        { icon: 'bi-clipboard-data', label: 'Scoring results & writing recommendations', doneAt: Infinity },
    ];

    readonly loaderElapsed = signal(0);
    readonly loaderStageIdx = computed(() => {
        const t = this.loaderElapsed();
        const idx = this.loaderStages.findIndex((s) => t < s.doneAt);
        return idx === -1 ? this.loaderStages.length - 1 : idx;
    });
    /** Approaches but never reaches 100% until the response actually lands. */
    readonly loaderPct = computed(() => Math.min(97, Math.round(100 * (1 - Math.exp(-this.loaderElapsed() / 16)))));

    private loaderTimer: ReturnType<typeof setInterval> | null = null;

    private startLoader(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.stopLoader();
        this.loaderElapsed.set(0);
        this.loaderTimer = setInterval(() => this.loaderElapsed.update((t) => t + 1), 1000);
    }

    private stopLoader(): void {
        if (this.loaderTimer !== null) {
            clearInterval(this.loaderTimer);
            this.loaderTimer = null;
        }
    }

    // --- Charts (inline SVG → SSR-safe, themed via CSS custom properties) ------

    /** Trend viewBox geometry (preserveAspectRatio="none" stretches to the card). */
    readonly TREND_VW = 320;
    readonly TREND_VH = 96;
    readonly TREND_PAD = 10;

    readonly trendPoints = computed(() => {
        const runs = this.historyRuns();
        const n = runs.length;
        const innerW = this.TREND_VW - this.TREND_PAD * 2;
        const innerH = this.TREND_VH - this.TREND_PAD * 2;
        // Fixed 0–100 domain so the same score always lands at the same height.
        return runs.map((run, i) => ({
            x: this.TREND_PAD + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW),
            y: this.TREND_PAD + innerH - (run.overall / 100) * innerH,
            at: run.at,
            overall: run.overall,
        }));
    });

    readonly trendLinePath = computed(() => {
        const pts = this.trendPoints();
        if (pts.length < 2) return '';
        return 'M' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
    });

    readonly trendAreaPath = computed(() => {
        const pts = this.trendPoints();
        if (pts.length < 2) return '';
        const base = (this.TREND_VH - this.TREND_PAD).toFixed(1);
        const inner = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
        return `M${pts[0].x.toFixed(1)},${base} L${inner} L${pts[pts.length - 1].x.toFixed(1)},${base} Z`;
    });

    /** Width of each invisible hover strip around a trend point. */
    readonly trendHitWidth = computed(() => {
        const n = this.trendPoints().length;
        return (this.TREND_VW - this.TREND_PAD * 2) / Math.max(n - 1, 1);
    });

    readonly trendHover = signal<number | null>(null);

    /** Gridline heights for the fixed 0/50/100 score marks. */
    readonly trendGridYs = computed(() => {
        const innerH = this.TREND_VH - this.TREND_PAD * 2;
        return [0, 50, 100].map((v) => this.TREND_PAD + innerH - (v / 100) * innerH);
    });

    /** Severity split as donut segments. stroke-dasharray on an r≈15.9155 circle
     *  gives a 100-unit circumference, so lengths are straight percentages. */
    readonly donutSegments = computed(() => {
        const t = this.issueTotals();
        const total = t.error + t.warn + t.good;
        if (!total) return [];
        const defs = [
            { key: 'error', label: 'Critical', count: t.error },
            { key: 'warn', label: 'Warnings', count: t.warn },
            { key: 'good', label: 'Passed', count: t.good },
        ].filter((d) => d.count > 0);
        const gap = defs.length > 1 ? 1.5 : 0; // surface gap between segments
        let offset = 25; // start at 12 o'clock
        return defs.map((d) => {
            const len = (d.count / total) * 100;
            const drawn = Math.max(len - gap, 0.5);
            const seg = { ...d, pct: Math.round((d.count / total) * 100), dash: `${drawn} ${100 - drawn}`, offset };
            offset -= len;
            return seg;
        });
    });

    readonly totalChecks = computed(() => {
        const t = this.issueTotals();
        return t.error + t.warn + t.good;
    });

    /** Sections ranked by problem count for the "where to look first" bars. */
    readonly sectionBars = computed(() => {
        const r = this.report();
        if (!r) return { rows: [] as { key: string; label: string; error: number; warn: number; total: number }[], max: 1, more: 0 };
        const rows = this.visibleSections()
            .map((s) => {
                const c = this.issueCounts(this.sectionIssues(s.key));
                return { key: s.key, label: s.label, error: c.error, warn: c.warn, total: c.error + c.warn };
            })
            .filter((b) => b.total > 0)
            .sort((a, b) => b.error - a.error || b.total - a.total);
        const max = Math.max(...rows.map((b) => b.total), 1);
        return { rows: rows.slice(0, 10), max, more: Math.max(rows.length - 10, 0) };
    });

    ngOnInit(): void {
        this.seo.update({
            title: 'SEO Audit Suite | Mohammad Hamza',
            description:
                'Free 26-check website audit: technical SEO, target keyword analysis, meta tags, headings, images, links, performance, accessibility, structured data, social previews, content, security, mobile — plus a real browser render at seven screen sizes, browser-support risks, hosting & tech-stack detection, marketing tags, 404-page quality, social handle and domain availability.',
            url: '/seo',
            keywords: 'seo audit, website audit, technical seo, keyword analysis, serp preview, responsive checker, browser compatibility, social media checker, domain availability, security headers',
        });

        // On load/reload (browser only — never during SSR): show the locally
        // stored report when we have one for the requested URL, otherwise fall
        // back to auto-running the audit from the ?url= query param.
        const qUrl = this.route.snapshot.queryParamMap.get('url');
        const qKeyword = this.route.snapshot.queryParamMap.get('keyword');
        if (qKeyword) this.keyword.set(qKeyword);
        if (isPlatformBrowser(this.platformId)) {
            const restored = this.restoreLastReport(qUrl);
            if (!restored && qUrl) {
                this.url.set(qUrl);
                this.run();
            }
        }
    }

    ngOnDestroy(): void {
        this.stopLoader();
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
        this.historyRuns.set([]);
        this.restoredAt.set(null);
        this.trendHover.set(null);
        this.startLoader();

        const keyword = this.keyword().trim();
        if (isPlatformBrowser(this.platformId)) {
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { url, keyword: keyword || null },
                queryParamsHandling: 'merge',
                replaceUrl: true,
            });
        }

        this.api.audit(url, keyword || undefined).subscribe({
            next: (res) => {
                this.stopLoader();
                this.report.set(res);
                this.loading.set(false);
                this.issueFilter.set('all');
                this.recordHistory(res);
                this.saveLastReport(res, keyword);
                this.openAllSections();
            },
            error: (err) => {
                this.stopLoader();
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

    /** Which device frame to draw around a breakpoint screenshot. */
    mockType(width: number): 'phone' | 'tablet' | 'laptop' | 'monitor' {
        if (width <= 414) return 'phone';
        if (width <= 1024) return 'tablet';
        if (width <= 1440) return 'laptop';
        return 'monitor';
    }

    renderModeLabel(mode: string): string {
        switch (mode) {
            case 'ssr': return 'SSR';
            case 'csr-shell': return 'CSR shell';
            case 'static': return 'Static';
            default: return 'Unknown';
        }
    }

    // --- Score history (localStorage, per audited URL) --------------------------

    private static readonly HISTORY_KEY = 'seo-audit-history-v1';

    /** Store this run's overall score; the trend chart and delta read historyRuns. */
    private recordHistory(r: SeoAuditReport): void {
        if (!isPlatformBrowser(this.platformId)) return;
        try {
            const key = r.finalUrl.replace(/\/$/, '');
            const raw = localStorage.getItem(SeoAuditComponent.HISTORY_KEY);
            const map: Record<string, { at: string; overall: number }[]> = raw ? JSON.parse(raw) : {};
            const runs = map[key] ?? [];
            runs.push({ at: r.fetchedAt, overall: r.scores.overall });
            map[key] = runs.slice(-10);
            // Cap the map itself so localStorage doesn't grow unbounded.
            const keys = Object.keys(map);
            if (keys.length > 30) delete map[keys[0]];
            localStorage.setItem(SeoAuditComponent.HISTORY_KEY, JSON.stringify(map));
            this.historyRuns.set(map[key]);
        } catch { /* history is best-effort */ }
    }

    /** Re-read stored runs for a URL without recording a new one (cache restore). */
    private loadHistory(finalUrl: string): void {
        if (!isPlatformBrowser(this.platformId)) return;
        try {
            const raw = localStorage.getItem(SeoAuditComponent.HISTORY_KEY);
            const map: Record<string, { at: string; overall: number }[]> = raw ? JSON.parse(raw) : {};
            this.historyRuns.set(map[finalUrl.replace(/\/$/, '')] ?? []);
        } catch { /* history is best-effort */ }
    }

    // --- Last-report cache (localStorage) ----------------------------------------

    private static readonly LAST_REPORT_KEY = 'seo-audit-last-report-v1';

    private saveLastReport(r: SeoAuditReport, keyword: string): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const entry: StoredReport = { savedAt: new Date().toISOString(), url: this.url().trim(), keyword, report: r };
        try {
            localStorage.setItem(SeoAuditComponent.LAST_REPORT_KEY, JSON.stringify(entry));
        } catch {
            // Screenshots are the bulk of the payload — retry without them before giving up.
            try {
                const slim: SeoAuditReport = {
                    ...r,
                    responsive: { ...r.responsive, viewports: r.responsive.viewports.map((v) => ({ ...v, screenshot: null })) },
                };
                localStorage.setItem(SeoAuditComponent.LAST_REPORT_KEY, JSON.stringify({ ...entry, report: slim }));
            } catch { /* cache is best-effort */ }
        }
    }

    /** Show the stored report if it matches the requested URL. Returns true when shown. */
    private restoreLastReport(qUrl: string | null): boolean {
        if (!isPlatformBrowser(this.platformId)) return false;
        try {
            const raw = localStorage.getItem(SeoAuditComponent.LAST_REPORT_KEY);
            if (!raw) return false;
            const entry = JSON.parse(raw) as StoredReport;
            if (!entry?.report?.scores) return false;
            // A shared/bookmarked ?url= pointing at a different page beats the cache.
            if (qUrl && !this.sameAuditUrl(qUrl, entry.url) && !this.sameAuditUrl(qUrl, entry.report.finalUrl)) return false;
            this.url.set(entry.url);
            if (entry.keyword) this.keyword.set(entry.keyword);
            this.report.set(entry.report);
            this.restoredAt.set(entry.report.fetchedAt);
            this.loadHistory(entry.report.finalUrl);
            this.openAllSections();
            return true;
        } catch {
            return false;
        }
    }

    private sameAuditUrl(a: string, b: string): boolean {
        const norm = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
        return norm(a) === norm(b);
    }

    /** Open every section so the full report reads top-to-bottom. */
    private openAllSections(): void {
        const all: Record<string, boolean> = {};
        for (const s of this.sections) all[s.key] = true;
        all['recommendations'] = true;
        this.open.set(all);
    }

    // --- Share -------------------------------------------------------------------

    async copyShareLink(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const ok = await copyText(window.location.href);
        if (ok) {
            this.shareCopied.set(true);
            setTimeout(() => this.shareCopied.set(false), 1600);
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
