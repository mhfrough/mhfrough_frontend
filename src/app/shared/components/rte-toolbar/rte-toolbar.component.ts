import { Component, Input, signal, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';

@Component({
    selector: 'app-rte-toolbar',
    standalone: true,
    imports: [CommonModule, ImgFallbackDirective],
    templateUrl: './rte-toolbar.component.html',
    styles: [':host { display: contents; }'],
})
export class RteToolbarComponent {
    private readonly http = inject(HttpClient);

    @Input() el: HTMLTextAreaElement | null = null;
    /** 'full' = admin blog/project (all tools incl. image, colors, headings)
     *  'minimal' = contact/comments/invoice-notes (bold/italic/underline/blockquote/list + emoji + link + clear) */
    @Input() mode: 'full' | 'minimal' = 'full';

    readonly showEmoji = signal(false);
    readonly showColor = signal(false);
    readonly showBg = signal(false);
    readonly emojiAlignRight = signal(false);
    readonly colorAlignRight = signal(false);
    readonly bgAlignRight = signal(false);
    readonly linkModal = signal<{ url: string; text: string } | null>(null);
    readonly imageModal = signal<{ url: string; alt: string } | null>(null);

    // ── Image upload state ─────────────────────────────────────────────────
    readonly imageUploading = signal(false);
    readonly imageDragOver = signal(false);
    readonly imagePreview = signal<string | null>(null); readonly imageUploadError = signal<string | null>(null);
    private savedSel = { start: 0, end: 0 };

    readonly emojis = [
        '😊', '👍', '🚀', '💡', '🔥', '✨', '💪', '🎯',
        '❤️', '👏', '🤝', '📌', '✅', '⚡', '🌟', '💬',
        '📝', '🔗', '🎨', '🎉',
    ];

    readonly textColors = [
        '#e4e0d8', '#ffffff', '#928e87', '#a8c4e0',
        '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
        '#c77dff', '#ff9f45',
    ];

    readonly bgColors = [
        '#2a2825', '#1f3d2a', '#1b2838', '#3d371f',
        '#3d1f1f', '#2d1f3d', '#1f3438', '#2d2a1f',
        '#3d2a1f', '#1f2a3d',
    ];

    // ─── Core format helpers ───────────────────────────────────────────────

    format(open: string, close: string) {
        if (!this.el) return;
        const el = this.el;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const sel = el.value.substring(start, end);
        el.setRangeText(open + (sel || 'text') + close, start, end, 'select');
        el.focus();
        el.dispatchEvent(new Event('input'));
    }

    clearFormat() {
        if (!this.el) return;
        const el = this.el;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        if (start === end) return;
        const stripped = el.value.substring(start, end).replace(/<[^>]+>/g, '');
        el.setRangeText(stripped, start, end, 'end');
        el.focus();
        el.dispatchEvent(new Event('input'));
    }

    // ─── Emoji dropdown ────────────────────────────────────────────────────

    private alignRight(e: MouseEvent): boolean {
        const btn = (e.currentTarget as HTMLElement).getBoundingClientRect();
        // panel is ~180px wide; check if it would overflow the right edge
        return btn.left + 180 > window.innerWidth - 8;
    }

    toggleEmoji(e: MouseEvent) {
        e.stopPropagation();
        const next = !this.showEmoji();
        this.closeDropdowns();
        if (next) this.emojiAlignRight.set(this.alignRight(e));
        this.showEmoji.set(next);
    }

    insertEmoji(emoji: string) {
        if (!this.el) return;
        const el = this.el;
        const pos = el.selectionStart;
        el.setRangeText(emoji, pos, el.selectionEnd, 'end');
        el.focus();
        el.dispatchEvent(new Event('input'));
        this.showEmoji.set(false);
    }

    // ─── Color palettes ────────────────────────────────────────────────────

    toggleColor(e: MouseEvent) {
        e.stopPropagation();
        const next = !this.showColor();
        this.closeDropdowns();
        if (next) this.colorAlignRight.set(this.alignRight(e));
        this.showColor.set(next);
    }

    toggleBg(e: MouseEvent) {
        e.stopPropagation();
        const next = !this.showBg();
        this.closeDropdowns();
        if (next) this.bgAlignRight.set(this.alignRight(e));
        this.showBg.set(next);
    }

    applyColor(color: string) {
        this.format(`<span style="color:${color}">`, '</span>');
        this.showColor.set(false);
    }

    applyBg(color: string) {
        this.format(`<span style="background:${color}">`, '</span>');
        this.showBg.set(false);
    }

    // ─── Link modal ────────────────────────────────────────────────────────

    openLinkModal() {
        if (!this.el) return;
        this.savedSel = { start: this.el.selectionStart, end: this.el.selectionEnd };
        const text = this.el.value.substring(this.savedSel.start, this.savedSel.end);
        this.closeDropdowns();
        this.linkModal.set({ url: '', text });
    }

    setLinkField(field: 'url' | 'text', e: Event) {
        const val = (e.target as HTMLInputElement).value;
        this.linkModal.update(m => m ? { ...m, [field]: val } : null);
    }

    confirmLink() {
        const m = this.linkModal();
        if (!m) return;
        this.linkModal.set(null);
        if (!m.url.trim() || !this.el) return;
        const display = m.text.trim() || m.url;
        const html = `<a href="${m.url}">${display}</a>`;
        this.el.setRangeText(html, this.savedSel.start, this.savedSel.end, 'end');
        this.el.focus();
        this.el.dispatchEvent(new Event('input'));
    }

    cancelLink() { this.linkModal.set(null); }

    // ─── Image modal ───────────────────────────────────────────────────────

    openImageModal() {
        this.closeDropdowns();
        this.imagePreview.set(null);
        this.imageModal.set({ url: '', alt: '' });
    }

    setImageField(field: 'url' | 'alt', e: Event) {
        const val = (e.target as HTMLInputElement).value;
        this.imageModal.update(m => m ? { ...m, [field]: val } : null);
        // if the URL field is changed manually, sync the preview
        if (field === 'url') this.imagePreview.set(val || null);
    }

    onImageDragOver(e: DragEvent) {
        e.preventDefault();
        this.imageDragOver.set(true);
    }

    onImageDragLeave() { this.imageDragOver.set(false); }

    onImageDrop(e: DragEvent) {
        e.preventDefault();
        this.imageDragOver.set(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) this.uploadImageFile(file);
    }

    onImageFileInput(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) this.uploadImageFile(file);
    }

    clearImagePreview() {
        this.imagePreview.set(null);
        this.imageUploadError.set(null);
        this.imageModal.update(m => m ? { ...m, url: '' } : null);
    }

    private uploadImageFile(file: File) {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
        if (!allowed.includes(file.type)) {
            this.imageUploadError.set('Invalid type — use JPEG, PNG, WebP, GIF or SVG.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.imageUploadError.set('File exceeds 5 MB limit.');
            return;
        }
        this.imageUploadError.set(null);
        const fd = new FormData();
        fd.append('file', file);
        this.imageUploading.set(true);
        this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image?type=content`, fd).subscribe({
            next: ({ url }) => {
                this.imagePreview.set(url);
                this.imageModal.update(m => m ? { ...m, url } : null);
                this.imageUploading.set(false);
            },
            error: () => {
                this.imageUploadError.set('Upload failed. Please try again.');
                this.imageUploading.set(false);
            },
        });
    }

    confirmImage() {
        const m = this.imageModal();
        if (!m) return;
        this.imageModal.set(null);
        this.imagePreview.set(null);
        if (!m.url.trim() || !this.el) return;
        const html = `<img src="${m.url}" alt="${m.alt || ''}" loading="lazy">`;
        const pos = this.el.selectionEnd;
        this.el.setRangeText(html, pos, pos, 'end');
        this.el.focus();
        this.el.dispatchEvent(new Event('input'));
    }

    cancelImage() {
        this.imageModal.set(null);
        this.imagePreview.set(null);
        this.imageUploadError.set(null);
        this.imageUploading.set(false);
    }

    // ─── Global event handlers ─────────────────────────────────────────────

    private closeDropdowns() {
        this.showEmoji.set(false);
        this.showColor.set(false);
        this.showBg.set(false);
    }

    @HostListener('document:keydown.escape')
    onEscape() {
        this.closeDropdowns();
        this.linkModal.set(null);
        this.imageModal.set(null);
        this.imagePreview.set(null);
        this.imageUploadError.set(null);
        this.imageUploading.set(false);
    }

    @HostListener('document:click', ['$event'])
    onDocClick(e: MouseEvent) {
        if (!(e.target as HTMLElement).closest('.rte-dropdown')) {
            this.closeDropdowns();
        }
    }
}
