import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadText } from '../shared/clipboard.util';

interface DiffRow {
    type: 'same' | 'add' | 'del';
    text: string;
    /** 1-based line number in the original text (same/del rows). */
    aNo?: number;
    /** 1-based line number in the changed text (same/add rows). */
    bNo?: number;
}

/** Per-side line cap; beyond this the tool refuses rather than freezing the tab. */
const MAX_LINES = 10_000;
/** Above this m×n the full LCS DP table is too expensive — use the trim fallback. */
const MAX_DP_CELLS = 4_000_000;

@Component({
    selector: 'app-diff-checker',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './diff-checker.component.html',
    styleUrl: './diff-checker.component.scss',
})
export class DiffCheckerComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly original = signal('');
    readonly changed = signal('');
    readonly ignoreCase = signal(false);
    readonly ignoreTrailingWs = signal(false);

    readonly error = signal<string | null>(null);
    readonly rows = signal<DiffRow[] | null>(null);
    readonly added = signal(0);
    readonly deleted = signal(0);
    readonly unchanged = signal(0);
    /** Set when the coarse prefix/suffix fallback was used instead of a full LCS. */
    readonly approximate = signal(false);
    readonly copied = signal(false);

    ngOnInit(): void {
        this.seo.update({
            title: 'Text Diff Checker | Dev Tools',
            description:
                'Compare two texts line by line and see additions, deletions and changes highlighted, with a copyable unified diff. Free, fully client-side diff tool.',
            url: '/tools/diff',
            keywords: 'diff checker, text compare, compare two texts, line diff, unified diff, online diff tool',
        });
    }

    compare(): void {
        this.error.set(null);
        this.rows.set(null);
        this.approximate.set(false);

        const a = this.original();
        const b = this.changed();
        if (!a.trim() && !b.trim()) {
            this.error.set('Paste some text on at least one side first.');
            return;
        }

        const linesA = a.split('\n');
        const linesB = b.split('\n');
        if (linesA.length > MAX_LINES || linesB.length > MAX_LINES) {
            this.error.set(`Each side is limited to ${MAX_LINES.toLocaleString()} lines (got ${linesA.length.toLocaleString()} / ${linesB.length.toLocaleString()}).`);
            return;
        }

        const keysA = linesA.map(l => this.normalize(l));
        const keysB = linesB.map(l => this.normalize(l));

        // Always trim the common prefix/suffix first — cheap and shrinks the DP.
        let start = 0;
        const maxStart = Math.min(keysA.length, keysB.length);
        while (start < maxStart && keysA[start] === keysB[start]) start++;

        let endA = keysA.length;
        let endB = keysB.length;
        while (endA > start && endB > start && keysA[endA - 1] === keysB[endB - 1]) {
            endA--;
            endB--;
        }

        const rows: DiffRow[] = [];
        for (let i = 0; i < start; i++) {
            rows.push({ type: 'same', text: linesA[i], aNo: i + 1, bNo: i + 1 });
        }

        const midA = endA - start;
        const midB = endB - start;
        if (midA * midB > MAX_DP_CELLS) {
            // Too big for the DP table: mark the whole middle as deleted + added.
            // Coarser than a real LCS, but bounded — and flagged in the UI.
            this.approximate.set(true);
            for (let i = start; i < endA; i++) rows.push({ type: 'del', text: linesA[i], aNo: i + 1 });
            for (let j = start; j < endB; j++) rows.push({ type: 'add', text: linesB[j], bNo: j + 1 });
        } else if (midA > 0 || midB > 0) {
            rows.push(...this.lcsDiff(linesA, keysA, start, endA, linesB, keysB, start, endB));
        }

        const tailLen = keysA.length - endA;
        for (let t = 0; t < tailLen; t++) {
            rows.push({ type: 'same', text: linesA[endA + t], aNo: endA + t + 1, bNo: endB + t + 1 });
        }

        this.rows.set(rows);
        this.added.set(rows.filter(r => r.type === 'add').length);
        this.deleted.set(rows.filter(r => r.type === 'del').length);
        this.unchanged.set(rows.filter(r => r.type === 'same').length);
        this.api.reportUsage({
            toolId: 'diff-checker',
            action: 'compare',
            metadata: { approximate: this.approximate() },
        });
    }

    async copyDiff(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const diff = this.unifiedDiff();
        if (!diff) return;
        if (await copyText(diff)) {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 1400);
            this.api.reportUsage({ toolId: 'diff-checker', action: 'copy' });
        }
    }

    downloadDiff(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const diff = this.unifiedDiff();
        if (!diff) return;
        downloadText(diff, 'diff.patch', 'text/plain');
        this.api.reportUsage({ toolId: 'diff-checker', action: 'download' });
    }

    // --- Diff engine -----------------------------------------------------------

    private normalize(line: string): string {
        let out = line;
        if (this.ignoreTrailingWs()) out = out.replace(/\s+$/, '');
        if (this.ignoreCase()) out = out.toLowerCase();
        return out;
    }

    /**
     * Classic LCS dynamic programme over the (already prefix/suffix-trimmed)
     * middle window, backtracked into same/add/del rows. Table size is bounded
     * by MAX_DP_CELLS before we get here.
     */
    private lcsDiff(
        linesA: string[], keysA: string[], startA: number, endA: number,
        linesB: string[], keysB: string[], startB: number, endB: number,
    ): DiffRow[] {
        const m = endA - startA;
        const n = endB - startB;
        const width = n + 1;
        const dp = new Uint32Array((m + 1) * width);

        for (let i = m - 1; i >= 0; i--) {
            for (let j = n - 1; j >= 0; j--) {
                dp[i * width + j] = keysA[startA + i] === keysB[startB + j]
                    ? dp[(i + 1) * width + j + 1] + 1
                    : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
            }
        }

        const rows: DiffRow[] = [];
        let i = 0;
        let j = 0;
        while (i < m && j < n) {
            if (keysA[startA + i] === keysB[startB + j]) {
                rows.push({ type: 'same', text: linesA[startA + i], aNo: startA + i + 1, bNo: startB + j + 1 });
                i++;
                j++;
            } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
                rows.push({ type: 'del', text: linesA[startA + i], aNo: startA + i + 1 });
                i++;
            } else {
                rows.push({ type: 'add', text: linesB[startB + j], bNo: startB + j + 1 });
                j++;
            }
        }
        while (i < m) {
            rows.push({ type: 'del', text: linesA[startA + i], aNo: startA + i + 1 });
            i++;
        }
        while (j < n) {
            rows.push({ type: 'add', text: linesB[startB + j], bNo: startB + j + 1 });
            j++;
        }
        return rows;
    }

    /** Simple unified-style diff of the current result (+/−/space prefixes). */
    private unifiedDiff(): string | null {
        const rows = this.rows();
        if (!rows) return null;
        const body = rows
            .map(r => (r.type === 'add' ? '+' : r.type === 'del' ? '-' : ' ') + r.text)
            .join('\n');
        return `--- original\n+++ changed\n${body}\n`;
    }
}
