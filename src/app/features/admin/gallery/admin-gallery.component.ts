import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { GalleryService, GalleryItem } from '../../../core/services/gallery.service';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';

@Component({
    selector: 'app-admin-gallery',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule, ImgFallbackDirective],
    templateUrl: './admin-gallery.component.html',
})
export class AdminGalleryComponent implements OnInit {
    private service = inject(GalleryService);

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

    readonly ALLOWED_MIME = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    ];
    readonly MAX_SIZE = 100 * 1024 * 1024;

    ngOnInit() { this.load(); }

    load() {
        this.service.getAllAdmin().subscribe({
            next: (d) => { this.items.set(d); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
    }

    openNew() {
        this.editing.set(null);
        this.mediaPreview.set(null);
        this.uploadError.set(null);
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
        this.uploadError.set(null);
        this.showForm.set(true);
    }

    cancel() {
        this.showForm.set(false);
        this.editing.set(null);
        this.mediaPreview.set(null);
        this.uploadError.set(null);
    }

    save(form: NgForm) {
        form.form.markAllAsTouched();
        if (form.invalid) return;
        if (!this.mediaPreview()?.url && !this.editing()) return;

        const preview = this.mediaPreview();
        const payload: Partial<GalleryItem> = {
            ...form.value,
            mediaUrl: preview?.url ?? this.editing()?.mediaUrl ?? '',
            mediaType: (preview?.mediaType as GalleryItem['mediaType']) ?? this.editing()?.mediaType ?? 'image',
            mimeType: preview?.mimeType || this.editing()?.mimeType,
            fileSize: preview?.fileSize || this.editing()?.fileSize,
        };

        this.saving.set(true);
        const obs = this.editing()
            ? this.service.update(this.editing()!.id, payload)
            : this.service.create(payload);

        obs.subscribe({
            next: () => { this.cancel(); this.saving.set(false); this.load(); },
            error: () => this.saving.set(false),
        });
    }

    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }

    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe({ next: () => this.load() });
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

    moveSortOrder(item: GalleryItem, direction: -1 | 1) {
        const list = [...this.items()].sort((a, b) => a.sortOrder - b.sortOrder);
        const idx = list.findIndex(i => i.id === item.id);
        const swapIdx = idx + direction;
        if (swapIdx < 0 || swapIdx >= list.length) return;

        const a = list[idx];
        const b = list[swapIdx];
        const aOrd = a.sortOrder;
        const bOrd = b.sortOrder;

        // Optimistic
        this.items.update(li => li.map(i => {
            if (i.id === a.id) return { ...i, sortOrder: bOrd };
            if (i.id === b.id) return { ...i, sortOrder: aOrd };
            return i;
        }));

        this.service.reorder([
            { id: a.id, sortOrder: bOrd },
            { id: b.id, sortOrder: aOrd },
        ]).subscribe({ error: () => this.load() });
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
        return [...this.items()].sort((a, b) => a.sortOrder - b.sortOrder);
    }
}
