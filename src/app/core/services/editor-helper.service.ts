import { Injectable } from '@angular/core';

/**
 * Shared editor-helper service.
 *
 * Provides textarea-based rich-text utilities (wrap selection with tags,
 * insert a link) that were previously duplicated verbatim across:
 *   - AdminBlogsComponent
 *   - AdminProjectsComponent
 *   - AdminInvoiceFormComponent
 *   - ContactComponent
 *   - BlogDetailComponent
 *
 * Inject this service and delegate the corresponding component methods to it.
 *
 * Note: `RteToolbarComponent` already has its own in-component versions of
 * these helpers because it needs them wired to its internal state. For all
 * other components that call these methods directly from their templates,
 * this service eliminates the duplicate code.
 */
@Injectable({ providedIn: 'root' })
export class EditorHelperService {

    /**
     * Wraps the current textarea selection (or the placeholder word "text")
     * with `open` and `close` HTML tags, then dispatches an 'input' event so
     * Angular's ngModel / reactive forms pick up the change.
     */
    format(el: HTMLTextAreaElement, open: string, close: string): void {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const sel = el.value.substring(start, end);
        const replacement = open + (sel || 'text') + close;
        el.setRangeText(replacement, start, end, 'select');
        el.focus();
        el.dispatchEvent(new Event('input'));
    }

    /**
     * Prompts for a URL and inserts an `<a>` tag at the current selection.
     * The selected text (if any) becomes the link label.
     */
    insertLink(el: HTMLTextAreaElement): void {
        const url = prompt('Enter URL:');
        if (!url) { el.focus(); return; }
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const label = el.value.substring(start, end) || 'link text';
        const html = `<a href="${url}">${label}</a>`;
        el.setRangeText(html, start, end, 'end');
        el.focus();
        el.dispatchEvent(new Event('input'));
    }

    /**
     * Strips all HTML tags from the current selection.
     */
    clearFormat(el: HTMLTextAreaElement): void {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        if (start === end) return;
        const stripped = el.value.substring(start, end).replace(/<[^>]+>/g, '');
        el.setRangeText(stripped, start, end, 'end');
        el.focus();
        el.dispatchEvent(new Event('input'));
    }
}
