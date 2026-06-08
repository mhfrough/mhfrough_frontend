import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GalleryService, GalleryItem } from '../../../core/services/gallery.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { TagInputComponent } from '../../../shared/components/tag-input/tag-input.component';

@Component({
    selector: 'app-admin-gallery',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule, ImgFallbackDirective, TagInputComponent],
    templateUrl: './admin-gallery.component.html',
})
export class AdminGalleryComponent implements OnInit, OnDestroy {
    private service = inject(GalleryService);
    private realtime = inject(RealtimeService);
    private subs = new Subscription();

    readonly items = signal<GalleryItem[]>([]);
    readonly loading = signal(true);
    readonly saving = signal(false);
    readonly uploading = signal(false);
    readonly dragOver = signal(false);
    readonly showForm = signal(false);
    readonly editing = signal<GalleryItem | null>(null);
    readonly deleteTargetId = signal<string | null>(null);
    readonly statusModal = signal<{ id: string } | null>(null);
    readonly uploadError = signal<string | null>(null);
    readonly mediaPreview = signal<{ url: string; mediaType: string; mimeType: string; fileSize: number } | null>(null);
    readonly allTags = signal<string[]>([]);
    readonly formTags = signal<string[]>([]);

    // ── Pagination + Search ──────────────────────────────────────────────────
    readonly searchQuery = signal('');
    readonly pageSize = signal(25);
    readonly currentPage = signal(1);

    readonly filteredItems = computed(() => {
        const q = this.searchQuery().toLowerCase().trim();
        const sorted = this.sortedItems();
        if (!q) return sorted;
        return sorted.filter(item =>
            item.title?.toLowerCase().includes(q) ||
            item.category?.toLowerCase().includes(q) ||
            item.caption?.toLowerCase().includes(q)
        );
    });

    readonly pagedItems = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.filteredItems().slice(start, start + this.pageSize());
    });

    readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredItems().length / this.pageSize()))
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

    readonly ALLOWED_MIME = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    ];
    readonly MAX_SIZE = 100 * 1024 * 1024;

    ngOnInit() {
        this.load();

        this.subs.add(this.realtime.on<GalleryItem>('gallery:created').subscribe(item => {
            this.items.update(list => [item, ...list]);
        }));

        this.subs.add(this.realtime.on<GalleryItem>('gallery:updated').subscribe(item => {
            this.items.update(list => list.map(i => i.id === item.id ? item : i));
        }));

        this.subs.add(this.realtime.on<{ id: string }>('gallery:deleted').subscribe(({ id }) => {
            this.items.update(list => list.filter(i => i.id !== id));
        }));

    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    load() {
        this.service.getAllAdmin().subscribe({
            next: (d) => { this.items.set(d); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
        this.service.getTags().subscribe({ next: t => this.allTags.set(t) });
    }

    openNew() {
        this.editing.set(null);
        this.mediaPreview.set(null);
        this.uploadError.set(null);
        this.formTags.set([]);
        this.showForm.set(true);
    }

    edit(item: GalleryItem) {
        this.editing.set({ ...item });
        this.mediaPreview.set({
            url: item.mediaUrl,
            mediaType: item.mediaType,
            mimeType: item.mimeType ?? '',
            fileSize: item.fileSize ?? 0,
        });
        this.formTags.set(item.tags ? [...item.tags] : []);
        this.uploadError.set(null);
        this.showForm.set(true);
    }

    cancel() {
        this.showForm.set(false);
        this.editing.set(null);
        this.mediaPreview.set(null);
        this.uploadError.set(null);
        this.formTags.set([]);
    }

    save(form: NgForm) {
        form.form.markAllAsTouched();
        if (form.invalid) return;
        if (!this.mediaPreview()?.url && !this.editing()) return;

        const preview = this.mediaPreview();
        const payload: Partial<GalleryItem> = {
            ...form.value,
            tags: this.formTags(),
            mediaUrl: preview?.url ?? this.editing()?.mediaUrl ?? '',
            mediaType: (preview?.mediaType as GalleryItem['mediaType']) ?? this.editing()?.mediaType ?? 'image',
            mimeType: preview?.mimeType || this.editing()?.mimeType,
            fileSize: Number(preview?.fileSize || this.editing()?.fileSize) || undefined,
        };

        this.saving.set(true);
        const obs = this.editing()
            ? this.service.update(this.editing()!.id, payload)
            : this.service.create(payload);

        obs.subscribe({
            next: () => { this.cancel(); this.saving.set(false); },
            error: () => this.saving.set(false),
        });
    }

    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }

    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe();
    }

    openHideModal(id: string) { this.statusModal.set({ id }); }
    cancelStatus() { this.statusModal.set(null); }
    executeStatus() {
        const m = this.statusModal();
        if (!m) return;
        this.statusModal.set(null);
        const item = this.items().find(i => i.id === m.id);
        if (!item) return;
        const updated = { ...item, isPublished: false };
        this.items.update(list => list.map(i => i.id === m.id ? updated : i));
        this.service.update(m.id, { isPublished: false }).subscribe({
            error: () => this.items.update(list => list.map(i => i.id === m.id ? item : i)),
        });
    }

    publishItem(item: GalleryItem) {
        const updated = { ...item, isPublished: true };
        this.items.update(list => list.map(i => i.id === item.id ? updated : i));
        this.service.update(item.id, { isPublished: true }).subscribe({
            error: () => this.items.update(list => list.map(i => i.id === item.id ? item : i)),
        });
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
        if (!this.ALLOWED_MIME.includes(file.type)) {
            this.uploadError.set('Unsupported type. Allowed: JPEG, PNG, WebP, GIF, SVG, MP4, WebM, OGG, MOV.');
            return;
        }
        if (file.size > this.MAX_SIZE) {
            this.uploadError.set('File exceeds 100 MB limit.');
            return;
        }
        this.uploadError.set(null);
        this.uploading.set(true);
        this.service.uploadMedia(file).subscribe({
            next: (res) => {
                this.mediaPreview.set({ url: res.url, mediaType: res.mediaType, mimeType: res.mimeType, fileSize: res.fileSize });
                this.uploading.set(false);
            },
            error: () => {
                this.uploadError.set('Upload failed. Please try again.');
                this.uploading.set(false);
            },
        });
    }

    formatBytes(bytes: number): string {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    sortedItems() {
        return [...this.items()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
}
