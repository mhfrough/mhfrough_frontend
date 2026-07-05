import {
    AfterViewInit, Component, ElementRef, OnInit, PLATFORM_ID,
    ViewChild, computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import hljs from 'highlight.js';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadDataUrl } from '../shared/clipboard.util';

type TextAlign = 'left' | 'center' | 'right';
type Mode = 'plain' | 'code';

interface LangOption {
    value: string;
    label: string;
}

/**
 * Minimal hljs token -> colour map, inlined into the exported SVG (no global
 * hljs theme stylesheet is imported). Tokens not listed fall back to --code-fg.
 */
const TOKEN_COLORS: Record<string, string> = {
    'hljs-comment': '#928e87',
    'hljs-quote': '#928e87',
    'hljs-keyword': '#c9a96e',
    'hljs-selector-tag': '#c9a96e',
    'hljs-built_in': '#89b4d4',
    'hljs-type': '#89b4d4',
    'hljs-literal': '#e08f6a',
    'hljs-number': '#e08f6a',
    'hljs-string': '#8fbe8f',
    'hljs-regexp': '#8fbe8f',
    'hljs-symbol': '#e08f6a',
    'hljs-class': '#89b4d4',
    'hljs-function': '#89b4d4',
    'hljs-title': '#89b4d4',
    'hljs-params': '#e4e0d8',
    'hljs-attr': '#89b4d4',
    'hljs-attribute': '#89b4d4',
    'hljs-variable': '#e4e0d8',
    'hljs-template-variable': '#e4e0d8',
    'hljs-property': '#89b4d4',
    'hljs-tag': '#928e87',
    'hljs-name': '#c9a96e',
    'hljs-meta': '#928e87',
    'hljs-bullet': '#e08f6a',
    'hljs-section': '#c9a96e',
    'hljs-deletion': '#f87171',
    'hljs-addition': '#22c55e',
};

@Component({
    selector: 'app-text-image',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './text-image.component.html',
    styleUrl: './text-image.component.scss',
    // Drive the code-mode live preview's syntax colours from the same TOKEN_COLORS map
    // (hex lives here as data; the SCSS only references these CSS variables).
    host: {
        '[style.--ci-comment]': 'tc["hljs-comment"]',
        '[style.--ci-keyword]': 'tc["hljs-keyword"]',
        '[style.--ci-built_in]': 'tc["hljs-built_in"]',
        '[style.--ci-literal]': 'tc["hljs-literal"]',
        '[style.--ci-number]': 'tc["hljs-number"]',
        '[style.--ci-string]': 'tc["hljs-string"]',
        '[style.--ci-symbol]': 'tc["hljs-symbol"]',
        '[style.--ci-title]': 'tc["hljs-title"]',
        '[style.--ci-attr]': 'tc["hljs-attr"]',
        '[style.--ci-variable]': 'tc["hljs-variable"]',
        '[style.--ci-tag]': 'tc["hljs-tag"]',
        '[style.--ci-name]': 'tc["hljs-name"]',
        '[style.--ci-meta]': 'tc["hljs-meta"]',
        '[style.--ci-section]': 'tc["hljs-section"]',
        '[style.--ci-deletion]': 'tc["hljs-deletion"]',
        '[style.--ci-addition]': 'tc["hljs-addition"]',
        '[style.--ci-dot-r]': 'dotR',
        '[style.--ci-dot-y]': 'dotY',
        '[style.--ci-dot-g]': 'dotG',
    },
})
export class TextImageComponent implements OnInit, AfterViewInit {
    /** Exposed to the host bindings above. */
    readonly tc = TOKEN_COLORS;
    readonly dotR = '#ff5f56';
    readonly dotY = '#ffbd2e';
    readonly dotG = '#27c93f';

    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly sanitizer = inject(DomSanitizer);

    @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;
    @ViewChild('card') cardRef?: ElementRef<HTMLElement>;

    readonly mode = signal<Mode>('plain');

    // --- Plain text mode ------------------------------------------------------
    readonly fonts = [
        'Inconsolata, monospace',
        'Arial, sans-serif',
        'Georgia, serif',
        'Times New Roman, serif',
        'Courier New, monospace',
        'Verdana, sans-serif',
        'Trebuchet MS, sans-serif',
    ];
    readonly aligns: TextAlign[] = ['left', 'center', 'right'];

    readonly text = signal('Hello world');
    readonly fontSize = signal(64);
    readonly fontFamily = signal('Inconsolata, monospace');
    readonly fontColor = signal('#e4e0d8');
    readonly bgColor = signal('#1a1917');
    readonly transparent = signal(false);
    readonly padding = signal(48);
    readonly align = signal<TextAlign>('center');

    private viewReady = false;

    // --- Code mode --------------------------------------------------------------
    readonly languages: LangOption[] = [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'typescript', label: 'TypeScript' },
        { value: 'javascript', label: 'JavaScript' },
        { value: 'html', label: 'HTML' },
        { value: 'xml', label: 'XML / HTML' },
        { value: 'css', label: 'CSS' },
        { value: 'scss', label: 'SCSS' },
        { value: 'json', label: 'JSON' },
        { value: 'python', label: 'Python' },
        { value: 'java', label: 'Java' },
        { value: 'csharp', label: 'C#' },
        { value: 'cpp', label: 'C++' },
        { value: 'go', label: 'Go' },
        { value: 'rust', label: 'Rust' },
        { value: 'php', label: 'PHP' },
        { value: 'ruby', label: 'Ruby' },
        { value: 'sql', label: 'SQL' },
        { value: 'bash', label: 'Bash' },
        { value: 'yaml', label: 'YAML' },
        { value: 'markdown', label: 'Markdown' },
    ];

    readonly code = signal(`function greet(name) {\n  return \`Hello, \${name}!\`;\n}`);
    readonly language = signal('typescript');
    readonly codeBgColor = signal('#242220');
    readonly codePadding = signal(32);
    readonly codeFontSize = signal(15);
    readonly showWindowTitle = signal(true);

    readonly copiedHtml = signal(false);
    readonly exporting = signal(false);
    readonly exportError = signal<string | null>(null);

    /** Raw highlighted HTML string (for copy + SVG export). Pure JS, SSR-safe. */
    private readonly rawHtml = computed<string>(() => {
        const code = this.code();
        const lang = this.language();
        try {
            if (lang && lang !== 'auto' && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        } catch {
            // Highlighting failed — fall back to escaped plain text.
            return this.escape(code);
        }
    });

    /**
     * Sanitized highlighted markup for [innerHTML]. bypassSecurityTrustHtml is
     * applied ONLY to hljs output (token spans), never to raw user input.
     */
    readonly highlightedHtml = computed<SafeHtml>(
        () => this.sanitizer.bypassSecurityTrustHtml(this.rawHtml()),
    );

    constructor() {
        // Re-render the plain-text canvas whenever any of its input signals change
        // (browser only, after view init, and only while in plain-text mode).
        effect(() => {
            // touch every dependency so the effect tracks them
            this.text(); this.fontSize(); this.fontFamily(); this.fontColor();
            this.bgColor(); this.transparent(); this.padding(); this.align(); this.mode();
            if (this.viewReady && this.mode() === 'plain') this.render();
        });
    }

    ngOnInit(): void {
        this.seo.update({
            title: 'Text & Code to Image Generator | Dev Tools',
            description:
                'Render styled text or syntax-highlighted code as a downloadable, printable image. Pick fonts, colours, languages and padding — all in your browser.',
            url: '/tools/text-image',
            keywords: 'text to image, code to image, text png generator, code screenshot, syntax highlight image',
        });
    }

    ngAfterViewInit(): void {
        this.viewReady = true;
        this.render();
    }

    setMode(mode: Mode): void {
        this.mode.set(mode);
        this.exportError.set(null);
        if (mode === 'plain') {
            // Canvas element only exists in the DOM for plain-text mode; re-render on switch back.
            setTimeout(() => this.render());
        }
    }

    private escape(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    private render(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const canvas = this.canvasRef?.nativeElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const fontSize = Math.max(8, Number(this.fontSize()) || 64);
        const pad = Math.max(0, Number(this.padding()) || 0);
        const font = this.fontFamily();
        const align = this.align();
        const lines = (this.text() || '').split('\n');
        const lineHeight = Math.round(fontSize * 1.3);

        // Measure to size the canvas.
        ctx.font = `${fontSize}px ${font}`;
        let maxWidth = 0;
        for (const line of lines) {
            maxWidth = Math.max(maxWidth, ctx.measureText(line || ' ').width);
        }
        const width = Math.ceil(maxWidth) + pad * 2;
        const height = lineHeight * lines.length + pad * 2;

        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        // Re-set context state (resizing the canvas resets it).
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!this.transparent()) {
            ctx.fillStyle = this.bgColor();
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.fillStyle = this.fontColor();
        ctx.font = `${fontSize}px ${font}`;
        ctx.textBaseline = 'top';
        ctx.textAlign = align;

        const x = align === 'left' ? pad : align === 'right' ? canvas.width - pad : canvas.width / 2;
        lines.forEach((line, i) => {
            ctx.fillText(line, x, pad + i * lineHeight);
        });
    }

    private toDataUrl(): string | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        const canvas = this.canvasRef?.nativeElement;
        if (!canvas) return null;
        try {
            return canvas.toDataURL('image/png');
        } catch {
            return null;
        }
    }

    async copyHtml(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        if (await copyText(this.rawHtml())) {
            this.copiedHtml.set(true);
            setTimeout(() => this.copiedHtml.set(false), 1400);
            this.api.reportUsage({ toolId: 'text-image', action: 'copy-html' });
        }
    }

    /** Inline <style> for the SVG export: window chrome + hljs token colours. */
    private buildSvgStyles(): string {
        const tokenRules = Object.entries(TOKEN_COLORS)
            .map(([cls, color]) => `.${cls}{color:${color}}`)
            .join('');
        return `
            *{margin:0;padding:0;box-sizing:border-box;}
            .ci-card{font-family:'Inconsolata','Courier New',monospace;border:1px solid rgba(228,224,216,0.10);}
            .ci-bar{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid rgba(228,224,216,0.10);}
            .ci-dot{width:12px;height:12px;border-radius:50%;display:inline-block;}
            .ci-dot.r{background:#ff5f56;}
            .ci-dot.y{background:#ffbd2e;}
            .ci-dot.g{background:#27c93f;}
            .ci-pre{margin:0;white-space:pre;overflow:visible;color:#e4e0d8;line-height:1.6;}
            ${tokenRules}
        `;
    }

    /**
     * DOM -> PNG via SVG <foreignObject>: wrap an XHTML clone of the code window
     * in an SVG, rasterise it onto a canvas, then export a PNG data URL.
     */
    private async downloadCodePng(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        if (typeof document === 'undefined' || typeof Image === 'undefined') return;

        this.exporting.set(true);
        this.exportError.set(null);
        try {
            const pad = Math.max(0, Number(this.codePadding()) || 0);
            const fontSize = Math.max(8, Number(this.codeFontSize()) || 15);
            const bg = this.codeBgColor();
            const scale = 2; // export at 2x for crisp output

            const bar = this.showWindowTitle()
                ? `<div class="ci-bar"><span class="ci-dot r"></span><span class="ci-dot y"></span><span class="ci-dot g"></span></div>`
                : '';
            const body =
                `<div xmlns="http://www.w3.org/1999/xhtml" class="ci-card" style="background:${bg};">` +
                bar +
                `<pre class="ci-pre" style="padding:${pad}px;font-size:${fontSize}px;"><code>${this.rawHtml()}</code></pre>` +
                `</div>`;

            // Measure the live card so the SVG canvas matches what the user sees.
            const live = this.cardRef?.nativeElement;
            const rect = live?.getBoundingClientRect();
            const width = Math.max(1, Math.ceil(rect?.width ?? 640));
            const height = Math.max(1, Math.ceil(rect?.height ?? 240));

            const svg =
                `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
                `<style>${this.buildSvgStyles()}</style>` +
                `<foreignObject x="0" y="0" width="${width}" height="${height}">${body}</foreignObject>` +
                `</svg>`;

            const dataUrl = await this.svgToPng(svg, width, height, scale);
            if (!dataUrl) {
                this.exportError.set('Image export failed in this browser. Try "Copy highlighted HTML" instead.');
                return;
            }
            downloadDataUrl(dataUrl, 'code.png');
            this.api.reportUsage({ toolId: 'text-image', action: 'code' });
        } catch {
            this.exportError.set('Image export failed in this browser. Try "Copy highlighted HTML" instead.');
        } finally {
            this.exporting.set(false);
        }
    }

    private svgToPng(svg: string, width: number, height: number, scale: number): Promise<string | null> {
        return new Promise((resolve) => {
            const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(width * scale));
                    canvas.height = Math.max(1, Math.round(height * scale));
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve(null);
                    ctx.scale(scale, scale);
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = encoded;
        });
    }

    /** Download button shared across both modes; routes to the right export routine. */
    async downloadPng(): Promise<void> {
        if (this.mode() === 'code') {
            await this.downloadCodePng();
            return;
        }
        const url = this.toDataUrl();
        if (!url) return;
        downloadDataUrl(url, 'text-image.png');
        this.api.reportUsage({ toolId: 'text-image', action: 'download' });
    }

    print(): void {
        if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') return;
        const url = this.mode() === 'code' ? null : this.toDataUrl();
        if (!url) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(
            `<!doctype html><html><head><title>Print</title>` +
            `<style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:#fff}` +
            `img{max-width:100%}</style></head><body>` +
            `<img src="${url}" alt="" onload="window.focus();window.print();" /></body></html>`
        );
        win.document.close();
        this.api.reportUsage({ toolId: 'text-image', action: 'print' });
    }
}
