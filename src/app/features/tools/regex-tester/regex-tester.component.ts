import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

type Flag = 'g' | 'i' | 'm' | 's' | 'u' | 'y';

interface FlagDef {
    flag: Flag;
    label: string;
}

interface GroupValue {
    name: string;
    value: string;
}

interface MatchRow {
    index: number;
    match: string;
    groups: GroupValue[];
}

interface RegexResult {
    error: string | null;
    matches: MatchRow[];
    /** Escaped-then-marked HTML string; see buildHighlight for the safety notes. */
    highlightHtml: string | null;
    truncated: boolean;
}

/** DoS guards: cap the test text and the number of collected matches. */
const MAX_TEXT_CHARS = 50_000;
const MAX_MATCHES = 1_000;

const COMMON_PATTERNS: Record<string, string> = {
    email: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    url: 'https?:\\/\\/[^\\s/$.?#][^\\s]*',
    ipv4: '\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\b',
    date: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])',
    hexColor: '#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\\b',
    uuid: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
};

@Component({
    selector: 'app-regex-tester',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './regex-tester.component.html',
    styleUrl: './regex-tester.component.scss',
})
export class RegexTesterComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly sanitizer = inject(DomSanitizer);

    readonly flagDefs: FlagDef[] = [
        { flag: 'g', label: 'g — global' },
        { flag: 'i', label: 'i — ignore case' },
        { flag: 'm', label: 'm — multiline' },
        { flag: 's', label: 's — dotall' },
        { flag: 'u', label: 'u — unicode' },
        { flag: 'y', label: 'y — sticky' },
    ];

    readonly pattern = signal('');
    readonly flags = signal<ReadonlySet<Flag>>(new Set<Flag>(['g']));
    readonly testText = signal('');
    readonly replacement = signal('');
    readonly preset = signal('');
    readonly copied = signal<'replace' | null>(null);

    /** Live evaluation — recomputes as the pattern / flags / text change. */
    readonly result = computed<RegexResult>(() => {
        const pattern = this.pattern();
        const text = this.testText();
        const flags = this.flagString();

        if (!pattern) return { error: null, matches: [], highlightHtml: null, truncated: false };
        if (text.length > MAX_TEXT_CHARS) {
            return {
                error: `Test text is too long (${text.length.toLocaleString()} characters). The limit is ${MAX_TEXT_CHARS.toLocaleString()}.`,
                matches: [], highlightHtml: null, truncated: false,
            };
        }

        // new RegExp on user input is safe (no code execution) but may be
        // syntactically invalid — surface that as a friendly error.
        let re: RegExp;
        try {
            re = new RegExp(pattern, flags);
        } catch (err) {
            return {
                error: err instanceof Error ? err.message : 'Invalid regular expression.',
                matches: [], highlightHtml: null, truncated: false,
            };
        }

        const matches = this.collectMatches(re, text);
        return {
            error: null,
            matches,
            highlightHtml: text ? this.buildHighlight(text, matches) : null,
            truncated: matches.length >= MAX_MATCHES,
        };
    });

    readonly regexError = computed(() => this.result().error);
    readonly matchCount = computed(() => this.result().matches.length);

    /**
     * SafeHtml for the highlighted view. This string is built entirely by us:
     * every user-provided segment is HTML-escaped FIRST, and only then are our
     * own literal <mark> tags inserted around match ranges — so bypassing
     * sanitization here never trusts raw user text.
     */
    readonly highlighted = computed<SafeHtml | null>(() => {
        const html = this.result().highlightHtml;
        return html === null ? null : this.sanitizer.bypassSecurityTrustHtml(html);
    });

    /** Live replace preview (fresh RegExp so exec-state never leaks between uses). */
    readonly replaced = computed<string | null>(() => {
        const res = this.result();
        if (res.error || !this.pattern()) return null;
        try {
            const re = new RegExp(this.pattern(), this.flagString());
            return this.testText().replace(re, this.replacement());
        } catch {
            return null;
        }
    });

    ngOnInit(): void {
        this.seo.update({
            title: 'Regex Tester | Dev Tools',
            description:
                'Test regular expressions live with match highlighting, capture groups, flags and a replace preview. Free, fully client-side regex tester.',
            url: '/tools/regex',
            keywords: 'regex tester, regular expression tester, regex match highlighting, regex groups, regex replace, javascript regex',
        });
    }

    toggleFlag(flag: Flag): void {
        const next = new Set(this.flags());
        if (next.has(flag)) next.delete(flag);
        else next.add(flag);
        this.flags.set(next);
    }

    hasFlag(flag: Flag): boolean {
        return this.flags().has(flag);
    }

    applyPreset(key: string): void {
        this.preset.set(key);
        const pattern = COMMON_PATTERNS[key];
        if (pattern) this.pattern.set(pattern);
    }

    /** Results are live; the explicit Test button only records the usage event. */
    test(): void {
        this.api.reportUsage({
            toolId: 'regex-tester',
            action: 'test',
            metadata: { flags: this.flagString(), matches: this.matchCount() },
        });
    }

    async copyReplaced(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.replaced();
        if (out === null) return;
        if (await copyText(out)) {
            this.copied.set('replace');
            setTimeout(() => this.copied.set(null), 1400);
            this.api.reportUsage({ toolId: 'regex-tester', action: 'copy' });
        }
    }

    // --- Matching --------------------------------------------------------------

    private flagString(): string {
        return this.flagDefs.map(d => d.flag).filter(f => this.flags().has(f)).join('');
    }

    private collectMatches(re: RegExp, text: string): MatchRow[] {
        const rows: MatchRow[] = [];
        if (!text) return rows;

        if (re.global || re.sticky) {
            let m: RegExpExecArray | null;
            while (rows.length < MAX_MATCHES && (m = re.exec(text)) !== null) {
                rows.push(this.toRow(m));
                // Zero-width match guard: if lastIndex didn't advance, bump it
                // manually so the loop can't spin forever.
                if (m.index === re.lastIndex) re.lastIndex++;
            }
        } else {
            const m = re.exec(text);
            if (m) rows.push(this.toRow(m));
        }
        return rows;
    }

    private toRow(m: RegExpExecArray): MatchRow {
        const groups: GroupValue[] = [];
        for (let i = 1; i < m.length; i++) {
            groups.push({ name: `$${i}`, value: m[i] ?? '' });
        }
        if (m.groups) {
            for (const [name, value] of Object.entries(m.groups)) {
                groups.push({ name, value: value ?? '' });
            }
        }
        return { index: m.index, match: m[0], groups };
    }

    /**
     * Build the highlight HTML. Security: user text segments are escaped via
     * escapeHtml BEFORE any markup is added; the only tags in the final string
     * are the literal <mark>/</mark> written below.
     */
    private buildHighlight(text: string, matches: MatchRow[]): string {
        let html = '';
        let cursor = 0;
        for (const m of matches) {
            if (m.index < cursor) continue; // overlapping sticky edge case — skip
            html += this.escapeHtml(text.slice(cursor, m.index));
            html += `<mark>${this.escapeHtml(m.match)}</mark>`;
            cursor = m.index + m.match.length;
        }
        html += this.escapeHtml(text.slice(cursor));
        return html;
    }

    private escapeHtml(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
