import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { BlogsService } from '../../../core/services/blogs.service';
import { EditorHelperService } from '../../../core/services/editor-helper.service';
import { AdminListBase } from '../../../shared/admin-list.base';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ImgUploadComponent } from '../../../shared/components/img-upload/img-upload.component';
import { RteToolbarComponent } from '../../../shared/components/rte-toolbar/rte-toolbar.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { TagInputComponent } from '../../../shared/components/tag-input/tag-input.component';

@Component({
    selector: 'app-admin-blogs',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        PaginationComponent, ConfirmModalComponent, ImgUploadComponent,
        RteToolbarComponent, ImgFallbackDirective, TagInputComponent,
    ],
    templateUrl: './admin-blogs.component.html',
})
export class AdminBlogsComponent extends AdminListBase implements OnInit {
    private service = inject(BlogsService);
    readonly editor = inject(EditorHelperService);

    readonly blogs = signal<any[]>([]);
    readonly loading = signal(true);
    readonly saving = signal(false);
    readonly editing = signal<any>(null);
    readonly showForm = signal(false);
    readonly coverPreview = signal<string | null>(null);
    readonly uploading = signal(false);
    readonly uploadError = signal<string | null>(null);
    readonly allTags = signal<string[]>([]);
    readonly formTags = signal<string[]>([]);

    readonly filteredBlogs = computed(() => {
        const q = this.searchQuery().toLowerCase().trim();
        const sorted = [...this.blogs()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        if (!q) return sorted;
        return sorted.filter(b =>
            b.title?.toLowerCase().includes(q) ||
            b.slug?.toLowerCase().includes(q) ||
            b.tags?.some((t: string) => t.toLowerCase().includes(q))
        );
    });

    readonly pagedBlogs = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.filteredBlogs().slice(start, start + this.pageSize());
    });

    override readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredBlogs().length / this.pageSize()))
    );

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

    onFileSelected(file: File): void {
        this.uploadError.set(null);
        this.uploading.set(true);
        this.service.uploadImage(file).subscribe({
            next: ({ url }) => { this.coverPreview.set(url); this.uploading.set(false); },
            error: () => { this.uploadError.set('Upload failed. Please try again.'); this.uploading.set(false); },
        });
    }

    override executeDelete(): void {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe(() => this.load());
    }

    openStatusModal(id: string): void { }
    cancelStatus(): void { }
    executeStatus(reason: string): void { }

    hideItem(id: string): void { this.service.unpublish(id).subscribe(() => this.load()); }
    publishItem(id: string): void { this.service.update(id, { isPublished: true }).subscribe(() => this.load()); }

    readonly dragRowId = signal<string | null>(null);
    readonly dragOverRowId = signal<string | null>(null);

    onRowDragStart(id: string): void { this.dragRowId.set(id); }
    onRowDragOver(e: DragEvent, id: string): void { e.preventDefault(); this.dragOverRowId.set(id); }
    onRowDragLeave(): void { this.dragOverRowId.set(null); }
    onRowDragEnd(): void { this.dragRowId.set(null); this.dragOverRowId.set(null); }
    onRowDrop(targetId: string): void {
        const srcId = this.dragRowId();
        this.dragRowId.set(null); this.dragOverRowId.set(null);
        if (!srcId || srcId === targetId) { return; }
        const list = [...this.blogs()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const src = list.find(b => b.id === srcId);
        const tgt = list.find(b => b.id === targetId);
        if (!src || !tgt) { return; }
        const srcOrd = src.sortOrder ?? 0;
        const tgtOrd = tgt.sortOrder ?? 0;
        this.blogs.update(li => li.map(b => {
            if (b.id === srcId) return { ...b, sortOrder: tgtOrd };
            if (b.id === targetId) return { ...b, sortOrder: srcOrd };
            return b;
        }));
        this.service.reorder([
            { id: srcId, sortOrder: tgtOrd },
            { id: targetId, sortOrder: srcOrd },
        ]).subscribe({ error: () => this.load() });
    }

    format(el: HTMLTextAreaElement, open: string, close: string): void {
        this.editor.format(el, open, close);
    }

    insertLink(el: HTMLTextAreaElement): void {
        this.editor.insertLink(el);
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
