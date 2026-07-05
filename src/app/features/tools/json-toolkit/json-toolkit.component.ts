import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadText } from '../shared/clipboard.util';

type Mode = 'format' | 'minify' | 'sort' | 'typescript';
type Indent = '2' | '4' | 'tab';

/** Hard cap on pasted input so a giant paste can't lock up the tab. */
const MAX_INPUT_CHARS = 2_000_000;

@Component({
    selector: 'app-json-toolkit',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './json-toolkit.component.html',
    styleUrl: './json-toolkit.component.scss',
})
export class JsonToolkitComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly mode = signal<Mode>('format');
    readonly indent = signal<Indent>('2');
    readonly input = signal('');

    readonly error = signal<string | null>(null);
    readonly output = signal<string | null>(null);
    readonly bytesIn = signal<number | null>(null);
    readonly bytesOut = signal<number | null>(null);
    readonly copied = signal(false);

    ngOnInit(): void {
        this.seo.update({
            title: 'JSON Toolkit | Dev Tools',
            description:
                'Format, validate, minify and sort JSON, or turn it into a TypeScript interface. Free, fully client-side JSON formatter and converter.',
            url: '/tools/json',
            keywords: 'json formatter, json validator, json minify, json sort keys, json to typescript, json toolkit',
        });
    }

    setMode(mode: Mode): void {
        this.mode.set(mode);
        this.output.set(null);
        this.error.set(null);
    }

    run(): void {
        const raw = this.input();
        this.output.set(null);
        this.error.set(null);
        this.bytesIn.set(null);
        this.bytesOut.set(null);

        if (!raw.trim()) {
            this.error.set('Paste some JSON first.');
            return;
        }
        if (raw.length > MAX_INPUT_CHARS) {
            this.error.set(`Input is too large (${raw.length.toLocaleString()} characters). The limit is ${MAX_INPUT_CHARS.toLocaleString()}.`);
            return;
        }

        // JSON.parse only — never eval. Any parse failure surfaces as a friendly error.
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            this.error.set(this.describeParseError(err, raw));
            return;
        }

        const mode = this.mode();
        let out: string;
        switch (mode) {
            case 'format':
                out = JSON.stringify(parsed, null, this.indentValue());
                break;
            case 'minify':
                out = JSON.stringify(parsed);
                break;
            case 'sort':
                out = JSON.stringify(this.sortKeysDeep(parsed), null, 2);
                break;
            case 'typescript':
                out = this.toTypeScript(parsed);
                break;
        }

        this.output.set(out);
        this.bytesIn.set(this.byteSize(raw));
        this.bytesOut.set(this.byteSize(out));
        this.api.reportUsage({ toolId: 'json-toolkit', action: mode });
    }

    async copyOutput(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.output();
        if (out === null) return;
        if (await copyText(out)) {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 1400);
            this.api.reportUsage({ toolId: 'json-toolkit', action: 'copy' });
        }
    }

    downloadOutput(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.output();
        if (out === null) return;
        if (this.mode() === 'typescript') {
            downloadText(out, 'types.ts', 'text/plain');
        } else {
            downloadText(out, 'data.json', 'application/json');
        }
        this.api.reportUsage({ toolId: 'json-toolkit', action: 'download' });
    }

    // --- Helpers -------------------------------------------------------------

    private indentValue(): string | number {
        const ind = this.indent();
        return ind === 'tab' ? '\t' : Number(ind);
    }

    /** UTF-8 byte size of a string (safe in both browser and SSR). */
    private byteSize(s: string): number {
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
        return s.length;
    }

    /**
     * Turn a JSON.parse error into a message with line/column where possible.
     * Newer engines say "at line L column C"; older V8 says "at position N",
     * from which we derive line/column by counting newlines.
     */
    private describeParseError(err: unknown, raw: string): string {
        const msg = err instanceof Error ? err.message : 'Invalid JSON.';
        const lineCol = /line (\d+) column (\d+)/i.exec(msg);
        if (lineCol) return `Invalid JSON at line ${lineCol[1]}, column ${lineCol[2]}: ${msg}`;
        const pos = /position (\d+)/i.exec(msg);
        if (pos) {
            const index = Math.min(Number(pos[1]), raw.length);
            const before = raw.slice(0, index);
            const line = before.split('\n').length;
            const col = index - before.lastIndexOf('\n');
            return `Invalid JSON at line ${line}, column ${col}: ${msg}`;
        }
        return `Invalid JSON: ${msg}`;
    }

    /** Recursively sort object keys alphabetically (arrays keep their order). */
    private sortKeysDeep(value: unknown): unknown {
        if (Array.isArray(value)) return value.map(v => this.sortKeysDeep(v));
        if (value !== null && typeof value === 'object') {
            const sorted: Record<string, unknown> = {};
            for (const key of Object.keys(value as Record<string, unknown>).sort()) {
                sorted[key] = this.sortKeysDeep((value as Record<string, unknown>)[key]);
            }
            return sorted;
        }
        return value;
    }

    // --- JSON → TypeScript -----------------------------------------------------

    /**
     * Infer TypeScript interfaces from a parsed JSON value.
     * Limitations (also noted in the generated header): array element types are
     * inferred from the first element only, null maps to `unknown`, and mixed
     * unions / optional properties are not detected.
     */
    private toTypeScript(value: unknown): string {
        const interfaces: string[] = [];
        const usedNames = new Set<string>();

        const uniqueName = (base: string): string => {
            let name = base;
            let i = 2;
            while (usedNames.has(name)) name = `${base}${i++}`;
            usedNames.add(name);
            return name;
        };

        const typeOf = (val: unknown, nameHint: string): string => {
            if (val === null) return 'unknown';
            if (typeof val === 'string') return 'string';
            if (typeof val === 'number') return 'number';
            if (typeof val === 'boolean') return 'boolean';
            if (Array.isArray(val)) {
                if (val.length === 0) return 'unknown[]';
                return `${typeOf(val[0], nameHint)}[]`;
            }
            if (typeof val === 'object') {
                const name = uniqueName(this.pascalCase(nameHint));
                const lines = Object.entries(val as Record<string, unknown>)
                    .map(([k, v]) => `    ${this.safePropertyKey(k)}: ${typeOf(v, k)};`);
                interfaces.push(`export interface ${name} {\n${lines.join('\n')}\n}`);
                return name;
            }
            return 'unknown';
        };

        const rootType = typeOf(value, 'Root');
        const header =
            '// Generated from JSON. Limitations: array element types are inferred from\n' +
            '// the first element only, null maps to `unknown`, and mixed unions /\n' +
            '// optional properties are not detected.\n';

        // Objects already emitted an interface named after the root hint;
        // primitives and arrays get a type alias instead.
        const rootAlias = value !== null && typeof value === 'object' && !Array.isArray(value)
            ? ''
            : `export type Root = ${rootType};\n\n`;

        return `${header}\n${rootAlias}${interfaces.join('\n\n')}${interfaces.length ? '\n' : ''}`;
    }

    /** PascalCase an arbitrary JSON key into a usable interface name. */
    private pascalCase(key: string): string {
        const name = key
            .split(/[^A-Za-z0-9]+/)
            .filter(Boolean)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join('');
        if (!name) return 'Item';
        return /^\d/.test(name) ? `Item${name}` : name;
    }

    /** Quote property keys that aren't valid TS identifiers. */
    private safePropertyKey(key: string): string {
        return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
    }
}
