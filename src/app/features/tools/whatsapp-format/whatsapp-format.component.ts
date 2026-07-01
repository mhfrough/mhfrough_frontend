import { Component, OnInit, PLATFORM_ID, ViewChild, ElementRef, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

type Wrap = '*' | '_' | '~' | '```';

@Component({
    selector: 'app-whatsapp-format',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './whatsapp-format.component.html',
    styleUrl: './whatsapp-format.component.scss',
})
export class WhatsappFormatComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    @ViewChild('editor') editor?: ElementRef<HTMLTextAreaElement>;

    readonly text = signal('');
    readonly copied = signal(false);

    /** Rendered WhatsApp markup → safe HTML for the preview pane. */
    readonly previewHtml = computed(() => this.render(this.text()));

    ngOnInit(): void {
        this.seo.update({
            title: 'WhatsApp Text Formatter | Dev Tools',
            description:
                'Add bold, italic, strikethrough and monospace formatting to WhatsApp messages, with a live preview. Free and browser-only.',
            url: '/tools/whatsapp-format',
            keywords: 'whatsapp formatter, whatsapp bold, whatsapp italic, whatsapp text format',
        });
    }

    /** Wrap the current selection (or the whole text) with the given markers. */
    apply(marker: Wrap): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const el = this.editor?.nativeElement;
        const value = this.text();
        let start = 0;
        let end = value.length;
        if (el) {
            start = el.selectionStart ?? 0;
            end = el.selectionEnd ?? 0;
            if (start === end) {
                // No selection — wrap the entire text.
                start = 0;
                end = value.length;
            }
        }
        const selected = value.slice(start, end);
        const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
        this.text.set(next);

        if (el) {
            // Restore a selection that now spans the wrapped content.
            const newStart = start + marker.length;
            const newEnd = newStart + selected.length;
            setTimeout(() => {
                el.focus();
                el.setSelectionRange(newStart, newEnd);
            });
        }
        this.api.reportUsage({ toolId: 'whatsapp-format', action: 'format', metadata: { marker } });
    }

    private escapeHtml(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Escape first, then convert WhatsApp markup to HTML, then line breaks. */
    private render(src: string): string {
        let html = this.escapeHtml(src);
        // Monospace block ```...``` first so its contents aren't re-parsed.
        html = html.replace(/```([\s\S]+?)```/g, (_m, c) => `<code>${c}</code>`);
        // Bold *...*
        html = html.replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)(?!\s)\*(?=[^\w*]|$)/g, '$1<strong>$2</strong>');
        // Italic _..._
        html = html.replace(/(^|[^\w_])_(?!\s)([^_\n]+?)(?!\s)_(?=[^\w_]|$)/g, '$1<em>$2</em>');
        // Strikethrough ~...~
        html = html.replace(/(^|[^\w~])~(?!\s)([^~\n]+?)(?!\s)~(?=[^\w~]|$)/g, '$1<s>$2</s>');
        // Line breaks.
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    async copyFormatted(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const out = this.text();
        if (!out) return;
        if (await copyText(out)) {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 1400);
            this.api.reportUsage({ toolId: 'whatsapp-format', action: 'copy' });
        }
    }
}
