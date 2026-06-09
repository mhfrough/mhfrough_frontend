import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectsService } from '../../../../core/services/projects.service';
import { RteToolbarComponent } from '../../../../shared/components/rte-toolbar/rte-toolbar.component';
import { TagInputComponent } from '../../../../shared/components/tag-input/tag-input.component';

@Component({
    selector: 'app-admin-project-form',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, RteToolbarComponent, TagInputComponent],
    templateUrl: './admin-project-form.component.html',
})
export class AdminProjectFormComponent implements OnInit {
    private service = inject(ProjectsService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    readonly loading = signal(true);
    readonly saving = signal(false);
    readonly editing = signal<any>(null);
    readonly editId = signal<string | null>(null);
    readonly thumbPreview = signal<string | null>(null);
    readonly uploading = signal(false);
    readonly dragOver = signal(false);
    readonly uploadError = signal<string | null>(null);
    readonly allTags = signal<string[]>([]);
    readonly formTags = signal<string[]>([]);

    ngOnInit() {
        this.service.getTags().subscribe({ next: t => this.allTags.set(t) });
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.editId.set(id);
            this.service.getOne(id).subscribe({
                next: (p: any) => {
                    this.editing.set({ ...p, techStack: p.techStack?.join(', ') });
                    this.thumbPreview.set(p.thumbnail || null);
                    this.formTags.set(p.tags ? [...p.tags] : []);
                    this.loading.set(false);
                },
                error: () => this.router.navigate(['/admin/projects']),
            });
        } else {
            this.loading.set(false);
        }
    }

    save(form: NgForm) {
        form.form.markAllAsTouched();
        if (form.invalid) return;
        this.saving.set(true);
        const payload = {
            ...form.value,
            tags: this.formTags(),
            techStack: form.value.techStack?.split(',').map((s: string) => s.trim()).filter(Boolean),
        };
        const obs = this.editId()
            ? this.service.update(this.editId()!, payload)
            : this.service.create(payload);
        obs.subscribe({
            next: () => this.router.navigate(['/admin/projects']),
            error: () => this.saving.set(false),
        });
    }

    cancel() { this.router.navigate(['/admin/projects']); }

    generateSlug(form: NgForm): void {
        const title = form.value.title ?? '';
        const slug = title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
        form.setValue({ ...form.value, slug });
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
        if (!allowed.includes(file.type)) { this.uploadError.set('Invalid type — use JPEG, PNG, WebP, GIF or SVG.'); return; }
        if (file.size > 5 * 1024 * 1024) { this.uploadError.set('File exceeds 5 MB limit.'); return; }
        this.uploadError.set(null);
        this.uploading.set(true);
        this.service.uploadImage(file).subscribe({
            next: ({ url }) => { this.thumbPreview.set(url); this.uploading.set(false); },
            error: () => { this.uploadError.set('Upload failed. Please try again.'); this.uploading.set(false); },
        });
    }

    format(el: HTMLTextAreaElement, open: string, close: string): void {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const sel = el.value.substring(start, end);
        el.setRangeText(open + (sel || 'text') + close, start, end, 'select');
        el.focus();
        el.dispatchEvent(new Event('input'));
    }

    insertLink(el: HTMLTextAreaElement): void {
        const url = prompt('Enter URL:');
        if (!url) { el.focus(); return; }
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const sel = el.value.substring(start, end) || 'link text';
        el.setRangeText(`<a href="${url}">${sel}</a>`, start, end, 'end');
        el.focus();
        el.dispatchEvent(new Event('input'));
    }
}
