import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, GenImageResponse } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText, downloadText, downloadDataUrl } from '../shared/clipboard.util';

type Mode = 'qr' | 'barcode';

@Component({
    selector: 'app-qr-barcode',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './qr-barcode.component.html',
    styleUrl: './qr-barcode.component.scss',
})
export class QrBarcodeComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly sanitizer = inject(DomSanitizer);
    private readonly platformId = inject(PLATFORM_ID);

    readonly mode = signal<Mode>('qr');

    // Shared
    readonly text = signal('https://www.mhfrough.dev');

    // QR options
    readonly size = signal(256);
    readonly margin = signal(2);
    readonly dark = signal('#1a1917');
    readonly light = signal('#ffffff');
    readonly ecLevel = signal<'L' | 'M' | 'Q' | 'H'>('M');
    readonly format = signal<'png' | 'svg'>('png');

    // Barcode options
    readonly barcodeType = signal('code128');
    readonly scale = signal(3);
    readonly height = signal(12);
    readonly includetext = signal(true);

    readonly barcodeTypes = [
        { id: 'code128', label: 'Code 128' },
        { id: 'code39', label: 'Code 39' },
        { id: 'ean13', label: 'EAN-13' },
        { id: 'ean8', label: 'EAN-8' },
        { id: 'upca', label: 'UPC-A' },
        { id: 'isbn', label: 'ISBN' },
        { id: 'code93', label: 'Code 93' },
        { id: 'interleaved2of5', label: 'Interleaved 2 of 5' },
        { id: 'datamatrix', label: 'Data Matrix' },
        { id: 'pdf417', label: 'PDF417' },
    ];

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly result = signal<GenImageResponse | null>(null);
    readonly copied = signal(false);

    readonly isSvg = computed(() => this.result()?.format === 'svg');
    readonly safeSvg = computed<SafeHtml | null>(() => {
        const r = this.result();
        return r && r.format === 'svg' ? this.sanitizer.bypassSecurityTrustHtml(r.output) : null;
    });

    ngOnInit(): void {
        this.seo.update({
            title: 'QR / Barcode Generator | Dev Tools',
            description:
                'Generate customisable QR codes and barcodes for any payload — set size, colours, error-correction and download as PNG or SVG.',
            url: '/tools/qr-barcode',
            keywords: 'qr code generator, barcode generator, code128, ean13, svg qr',
        });
    }

    setMode(m: Mode): void {
        if (this.mode() === m) return;
        this.mode.set(m);
        this.result.set(null);
        this.error.set(null);
    }

    generate(): void {
        const text = this.text().trim();
        if (!text) {
            this.error.set('Enter some text or a URL to encode.');
            return;
        }
        this.loading.set(true);
        this.error.set(null);
        this.result.set(null);

        const req$ = this.mode() === 'qr'
            ? this.api.qr({
                text,
                size: this.size(),
                margin: this.margin(),
                dark: this.dark(),
                light: this.light(),
                ecLevel: this.ecLevel(),
                format: this.format(),
            })
            : this.api.barcode({
                text,
                type: this.barcodeType(),
                scale: this.scale(),
                height: this.height(),
                includetext: this.includetext(),
            });

        req$.subscribe({
            next: (res) => {
                this.result.set(res);
                this.loading.set(false);
                this.api.reportUsage({ toolId: 'qr-barcode', action: this.mode() });
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.message ?? 'Could not generate the code. Check your input and try again.');
            },
        });
    }

    download(): void {
        const r = this.result();
        if (!r || !isPlatformBrowser(this.platformId)) return;
        if (r.format === 'svg') {
            downloadText(r.output, 'qr-code.svg', 'image/svg+xml');
        } else {
            const name = this.mode() === 'qr' ? 'qr-code.png' : 'barcode.png';
            downloadDataUrl(r.output, name);
        }
        this.api.reportUsage({ toolId: 'qr-barcode', action: 'download' });
    }

    async copySvg(): Promise<void> {
        const r = this.result();
        if (!r || r.format !== 'svg' || !isPlatformBrowser(this.platformId)) return;
        if (await copyText(r.output)) {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 1400);
        }
    }
}
