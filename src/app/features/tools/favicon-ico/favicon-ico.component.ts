import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, ImageResult } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { downloadDataUrl } from '../shared/clipboard.util';

@Component({
    selector: 'app-favicon-ico',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './favicon-ico.component.html',
    styleUrl: './favicon-ico.component.scss',
})
export class FaviconIcoComponent implements OnInit, OnDestroy {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly file = signal<File | null>(null);
    readonly previewUrl = signal<string | null>(null);
    readonly dragOver = signal(false);

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly result = signal<ImageResult | null>(null);

    ngOnInit(): void {
        this.seo.update({
            title: 'Favicon (.ico) Generator | Dev Tools',
            description:
                'Turn any image into a multi-size favicon.ico (16/32/48/64) ready to drop into your site. Free online favicon generator.',
            url: '/tools/favicon',
            keywords: 'favicon generator, ico generator, create favicon, favicon.ico, multi-size favicon',
        });
    }

    ngOnDestroy(): void {
        this.revokePreview();
    }

    private revokePreview(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const prev = this.previewUrl();
        if (prev) URL.revokeObjectURL(prev);
    }

    onFileInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.setFile(input.files?.[0] ?? null);
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(false);
        const file = event.dataTransfer?.files?.[0] ?? null;
        if (file && file.type.startsWith('image/')) this.setFile(file);
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(true);
    }

    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(false);
    }

    private setFile(file: File | null): void {
        this.revokePreview();
        this.file.set(file);
        this.result.set(null);
        this.error.set(null);
        if (file && isPlatformBrowser(this.platformId)) {
            this.previewUrl.set(URL.createObjectURL(file));
        } else {
            this.previewUrl.set(null);
        }
    }

    run(): void {
        const file = this.file();
        if (!file) {
            this.error.set('Choose an image first.');
            return;
        }
        this.loading.set(true);
        this.error.set(null);
        this.result.set(null);

        this.api.faviconIco(file).subscribe({
            next: (res) => {
                this.result.set(res);
                this.loading.set(false);
                this.api.reportUsage({ toolId: 'favicon-ico', action: 'run' });
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(err?.error?.message ?? 'Favicon generation failed. Try a different image.');
            },
        });
    }

    download(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const res = this.result();
        if (!res) return;
        downloadDataUrl(res.output, 'favicon.ico');
        this.api.reportUsage({ toolId: 'favicon-ico', action: 'download' });
    }

    formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
}
