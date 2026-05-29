import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { BlogsService } from '../../../core/services/blogs.service';
import { RteToolbarComponent } from '../../../shared/components/rte-toolbar/rte-toolbar.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { TagInputComponent } from '../../../shared/components/tag-input/tag-input.component';

@Component({
    selector: 'app-admin-blogs',
    standalone: true,
    imports: [CommonModule, FormsModule, RteToolbarComponent, ImgFallbackDirective, TagInputComponent],
    templateUrl: './admin-blogs.component.html',
})
export class AdminBlogsComponent implements OnInit {
    private service = inject(BlogsService);
    readonly blogs = signal<any[]>([]);
    readonly loading = signal(true);
    readonly saving = signal(false);
    readonly editing = signal<any>(null);
    readonly showForm = signal(false);
    readonly deleteTargetId = signal<string | null>(null);
    readonly statusModal = signal<{ id: string; title: string; reason: string } | null>(null);
    readonly coverPreview = signal<string | null>(null);
    readonly uploading = signal(false);
    readonly dragOver = signal(false);
    readonly uploadError = signal<string | null>(null);
    readonly allTags = signal<string[]>([]);
    readonly formTags = signal<string[]>([]);

    // ── Pagination + Search ──────────────────────────────────────────────────
    readonly searchQuery = signal('');
    readonly pageSize = signal(25);
    readonly currentPage = signal(1);

    readonly filteredBlogs = computed(() => {
        const q = this.searchQuery().toLowerCase().trim();
        if (!q) return this.blogs();
        return this.blogs().filter(b =>
            b.title?.toLowerCase().includes(q) ||
            b.slug?.toLowerCase().includes(q) ||
            b.tags?.some((t: string) => t.toLowerCase().includes(q))
        );
    });

    readonly pagedBlogs = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.filteredBlogs().slice(start, start + this.pageSize());
    });

    readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredBlogs().length / this.pageSize()))
    );

    get pageNumbers(): number[] {
        const total = this.totalPages();
        const cur = this.currentPage();
        const pages: number[] = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) {
            pages.push(i);
        }
        return pages;
    }

    onSearch(e: Event) {
        this.searchQuery.set((e.target as HTMLInputElement).value);
        this.currentPage.set(1);
    }

    onPageSizeChange(e: Event) {
        this.pageSize.set(+(e.target as HTMLSelectElement).value);
        this.currentPage.set(1);
    }

    ngOnInit() { this.load(); }

    load() {
        this.service.getAllAdmin().subscribe({ next: (d: any[]) => { this.blogs.set(d); this.loading.set(false); } });
        this.service.getTags().subscribe({ next: t => this.allTags.set(t) });
    }

    openNew() { this.editing.set(null); this.coverPreview.set(null); this.uploadError.set(null); this.formTags.set([]); this.showForm.set(true); }

    edit(b: any) {
        this.editing.set({ ...b });
        this.coverPreview.set(b.coverImage || null);
        this.formTags.set(b.tags ? [...b.tags] : []);
        this.uploadError.set(null);
        this.showForm.set(true);
    }

    cancel() { this.showForm.set(false); this.editing.set(null); this.coverPreview.set(null); this.uploadError.set(null); this.formTags.set([]); }

    save(form: NgForm) {
        form.form.markAllAsTouched();
        if (form.invalid) return;
        this.saving.set(true);
        const payload = { ...form.value, tags: this.formTags() };
        const obs = this.editing() ? this.service.update(this.editing().id, payload) : this.service.create(payload);
        obs.subscribe({ next: () => { this.load(); this.cancel(); this.saving.set(false); } });
    }

    onDragOver(e: DragEvent) { e.preventDefault(); this.dragOver.set(true); }
    onDragLeave() { this.dragOver.set(false); }

    onDrop(e: DragEvent) {
        e.preventDefault();
        this.dragOver.set(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) this.uploadFile(file);
    }

    onFileInput(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) this.uploadFile(file);
    }

    private uploadFile(file: File) {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
        if (!allowed.includes(file.type)) {
            this.uploadError.set('Invalid type — use JPEG, PNG, WebP, GIF or SVG.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.uploadError.set('File exceeds 5 MB limit.');
            return;
        }
        this.uploadError.set(null);
        this.uploading.set(true);
        this.service.uploadImage(file).subscribe({
            next: ({ url }) => {
                this.coverPreview.set(url);
                this.uploading.set(false);
            },
            error: () => {
                this.uploadError.set('Upload failed. Please try again.');
                this.uploading.set(false);
            },
        });
    }

    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }

    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe(() => this.load());
    }

    openStatusModal(id: string) { this.statusModal.set({ id, title: 'Unpublish Blog Post', reason: '' }); }
    cancelStatus() { this.statusModal.set(null); }
    setStatusReason(e: Event) {
        const val = (e.target as HTMLTextAreaElement).value;
        this.statusModal.update(m => m ? { ...m, reason: val } : null);
    }
    executeStatus() {
        const m = this.statusModal();
        if (!m) return;
        this.statusModal.set(null);
        this.service.unpublish(m.id, m.reason || undefined).subscribe(() => this.load());
    }

    format(el: HTMLTextAreaElement, open: string, close: string): void {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const sel = el.value.substring(start, end);
        const replacement = open + (sel || 'text') + close;
        el.setRangeText(replacement, start, end, 'select');
        el.focus();
        el.dispatchEvent(new Event('input'));
    }

    insertLink(el: HTMLTextAreaElement): void {
        const url = prompt('Enter URL:');
        if (!url) { el.focus(); return; }
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const sel = el.value.substring(start, end) || 'link text';
        const html = `<a href="${url}">${sel}</a>`;
        el.setRangeText(html, start, end, 'end');
        el.focus();
        el.dispatchEvent(new Event('input'));
    }

    generateSlug(form: NgForm): void {
        const title = form.value.title ?? '';
        const slug = title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/[\s_]+/g, '-')
            .replace(/-+/g, '-');
        form.setValue({ ...form.value, slug });
    }

    calcReadTime(form: NgForm): void {
        const content: string = form.value.content ?? '';
        const stripped = content.replace(/<[^>]*>/g, ' ');
        const words = stripped.trim().split(/\s+/).filter(Boolean).length;
        const mins = Math.max(1, Math.ceil(words / 200));
        form.setValue({ ...form.value, readTimeMinutes: mins });
    }
}
