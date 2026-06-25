import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { GalleryService, GalleryItem } from '../../../../core/services/gallery.service';
import { TagInputComponent } from '../../../../shared/components/tag-input/tag-input.component';
import { ImgUploadComponent } from '../../../../shared/components/img-upload/img-upload.component';

@Component({
    selector: 'app-admin-gallery-form',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, TagInputComponent, ImgUploadComponent],
    templateUrl: './admin-gallery-form.component.html',
})
export class AdminGalleryFormComponent implements OnInit {
    private service = inject(GalleryService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    readonly loading = signal(true);
    readonly saving = signal(false);
    readonly uploading = signal(false);
    readonly editing = signal<GalleryItem | null>(null);
    readonly editId = signal<string | null>(null);
    readonly uploadError = signal<string | null>(null);
    readonly mediaPreview = signal<{ url: string; mediaType: string; mimeType: string; fileSize: number } | null>(null);
    readonly allTags = signal<string[]>([]);
    readonly formTags = signal<string[]>([]);

    readonly ALLOWED_MIME = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    ];

    ngOnInit() {
        this.service.getTags().subscribe({ next: t => this.allTags.set(t) });
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.editId.set(id);
            this.service.getOne(id).subscribe({
                next: (item: GalleryItem) => {
                    this.editing.set({ ...item });
                    this.mediaPreview.set({
                        url: item.mediaUrl,
                        mediaType: item.mediaType,
                        mimeType: item.mimeType ?? '',
                        fileSize: item.fileSize ?? 0,
                    });
                    this.formTags.set(item.tags ? [...item.tags] : []);
                    this.loading.set(false);
                },
                error: () => this.router.navigate(['/admin/gallery']),
            });
        } else {
            this.loading.set(false);
        }
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
        const obs = this.editId()
            ? this.service.update(this.editId()!, payload)
            : this.service.create(payload);
        obs.subscribe({
            next: () => this.router.navigate(['/admin/gallery']),
            error: () => this.saving.set(false),
        });
    }

    cancel() { this.router.navigate(['/admin/gallery']); }

    /** Receives an already-validated file from <app-img-upload> and uploads it. */
    onFileSelected(file: File) {
        this.uploadError.set(null);
        this.uploading.set(true);
        this.service.uploadMedia(file).subscribe({
            next: (res) => {
                this.mediaPreview.set({ url: res.url, mediaType: res.mediaType, mimeType: res.mimeType, fileSize: res.fileSize });
                this.uploading.set(false);
            },
            error: () => { this.uploadError.set('Upload failed. Please try again.'); this.uploading.set(false); },
        });
    }

    /** How <app-img-upload> should render the current preview. */
    previewType(): 'image' | 'video' {
        return this.mediaPreview()?.mediaType === 'video' ? 'video' : 'image';
    }

    /** Caption shown under the upload preview, e.g. "VIDEO · 2.3 MB". */
    mediaMeta(): string | null {
        const p = this.mediaPreview();
        if (!p) return null;
        return `${p.mediaType.toUpperCase()} · ${this.formatBytes(p.fileSize)}`;
    }

    formatBytes(bytes: number): string {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}
