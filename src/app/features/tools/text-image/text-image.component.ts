import {
    AfterViewInit, Component, ElementRef, OnInit, PLATFORM_ID,
    ViewChild, effect, inject, signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { downloadDataUrl } from '../shared/clipboard.util';

type TextAlign = 'left' | 'center' | 'right';

@Component({
    selector: 'app-text-image',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './text-image.component.html',
    styleUrl: './text-image.component.scss',
})
export class TextImageComponent implements OnInit, AfterViewInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;

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

    constructor() {
        // Re-render whenever any input signal changes (browser only, after view init).
        effect(() => {
            // touch every dependency so the effect tracks them
            this.text(); this.fontSize(); this.fontFamily(); this.fontColor();
            this.bgColor(); this.transparent(); this.padding(); this.align();
            if (this.viewReady) this.render();
        });
    }

    ngOnInit(): void {
        this.seo.update({
            title: 'Text to Image Generator | Dev Tools',
            description:
                'Turn any text into a downloadable PNG image. Pick the font, size, colour, background and padding, then export or print — all in your browser.',
            url: '/tools/text-image',
            keywords: 'text to image, text png generator, make image from text, text image maker',
        });
    }

    ngAfterViewInit(): void {
        this.viewReady = true;
        this.render();
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

    downloadPng(): void {
        const url = this.toDataUrl();
        if (!url) return;
        downloadDataUrl(url, 'text-image.png');
        this.api.reportUsage({ toolId: 'text-image', action: 'download' });
    }

    print(): void {
        if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') return;
        const url = this.toDataUrl();
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
