import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Shared image / media upload zone with drag-and-drop support.
 *
 * This component handles the UI and file validation only.
 * The parent is responsible for the actual HTTP upload and passes back
 * the result via the `previewUrl` input once the upload completes.
 *
 * Usage (image-only, 5 MB cap):
 *   <app-img-upload
 *     [previewUrl]="coverPreview()"
 *     [uploading]="uploading()"
 *     [uploadError]="uploadError()"
 *     (fileSelected)="onFileSelected($event)"
 *     (cleared)="coverPreview.set(null)"
 *   />
 *
 * Usage (image + video, 100 MB cap):
 *   <app-img-upload
 *     accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime"
 *     [allowedTypes]="ALLOWED_MIME"
 *     [maxSizeMb]="100"
 *     hint="Images · GIF · MP4 · WebM · OGG · MOV"
 *     ...
 *   />
 */
@Component({
    selector: 'app-img-upload',
    standalone: true,
    imports: [CommonModule],
    template: `
<div class="img-upload-zone"
     [class.drag-over]="dragOver()"
     (dragover)="onDragOver($event)"
     (dragleave)="dragOver.set(false)"
     (drop)="onDrop($event)">

    @if (uploading()) {
        <div class="img-upload-placeholder">
            <span class="contact-spinner"></span>&nbsp; Uploading…
        </div>
    } @else if (previewUrl()) {
        <div class="img-upload-preview">
            @if (previewType() === 'video') {
                <video [src]="previewUrl()!" style="max-height:140px;max-width:100%" controls muted></video>
            } @else {
                <img [src]="previewUrl()!" alt="Preview" loading="lazy" />
            }
            @if (previewMeta()) {
                <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.4rem;text-align:center">{{ previewMeta() }}</div>
            }
            <button type="button" class="img-upload-clear" (click)="cleared.emit()">
                <i class="bi bi-x-circle-fill"></i>
            </button>
        </div>
    } @else {
        <div class="img-upload-placeholder">
            <i class="bi bi-cloud-upload" style="font-size:1.5rem"></i>
            <span>Drag &amp; drop, or
                <label class="img-upload-browse">browse
                    <input type="file" [accept]="accept()" (change)="onFileInput($event)" hidden>
                </label>
            </span>
            @if (hint()) {
                <span style="font-size:0.75rem;color:var(--text-muted)">{{ hint() }}</span>
            }
        </div>
    }
</div>

@if (displayError()) {
    <p style="font-size:0.78rem;color:#ef4444;margin-top:0.35rem;margin-bottom:0">
        <i class="bi bi-exclamation-circle"></i> {{ displayError() }}
    </p>
}
`,
    styles: [':host { display: contents; }'],
})
export class ImgUploadComponent {
    /** HTML accept attribute for the hidden file input. */
    readonly accept = input('image/*');
    /** Allowed MIME types for validation. Empty = allow all. */
    readonly allowedTypes = input<string[]>([
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    ]);
    /** Maximum file size in megabytes. */
    readonly maxSizeMb = input(5);
    /** Hint text shown below the drag-drop prompt. */
    readonly hint = input('JPEG, PNG, WebP, GIF · max 5 MB');
    /** URL of the currently uploaded / previewed media (from parent). */
    readonly previewUrl = input<string | null>(null);
    /** How to render the preview — an image thumbnail or a video player. */
    readonly previewType = input<'image' | 'video'>('image');
    /** Optional caption shown under the preview (e.g. "VIDEO · 2.3 MB"). */
    readonly previewMeta = input<string | null>(null);
    /** Whether the parent is currently uploading. */
    readonly uploading = input(false);
    /** Error message from the parent's upload attempt. */
    readonly uploadError = input<string | null>(null);

    /** Emitted when a valid file is selected — parent should upload it. */
    readonly fileSelected = output<File>();
    /** Emitted when the user clicks the clear/remove button. */
    readonly cleared = output<void>();

    readonly dragOver = signal(false);

    onDragOver(e: DragEvent): void {
        e.preventDefault();
        this.dragOver.set(true);
    }

    onDrop(e: DragEvent): void {
        e.preventDefault();
        this.dragOver.set(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) this.validate(file);
    }

    onFileInput(e: Event): void {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) this.validate(file);
    }

    private validate(file: File): void {
        const allowed = this.allowedTypes();
        if (allowed.length && !allowed.includes(file.type)) {
            // Emit a synthetic error via a custom DOM event so callers can
            // handle the message; we also surface it via a local signal for
            // the template — but since we can't write to input signals we
            // emit an uploadError output instead.
            this._validationError.set(
                `Invalid file type. Allowed: ${allowed.map(t => t.split('/')[1]).join(', ')}.`
            );
            return;
        }
        const maxBytes = this.maxSizeMb() * 1024 * 1024;
        if (file.size > maxBytes) {
            this._validationError.set(`File exceeds ${this.maxSizeMb()} MB limit.`);
            return;
        }
        this._validationError.set(null);
        this.fileSelected.emit(file);
    }

    /** Internal validation error (distinct from parent's uploadError). */
    readonly _validationError = signal<string | null>(null);

    /** The error to display: validation errors take priority over upload errors. */
    displayError(): string | null {
        return this._validationError() ?? this.uploadError();
    }
}
