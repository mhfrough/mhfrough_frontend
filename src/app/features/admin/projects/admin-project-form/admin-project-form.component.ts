import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectsService } from '../../../../core/services/projects.service';
import { RteToolbarComponent } from '../../../../shared/components/rte-toolbar/rte-toolbar.component';
import { TagInputComponent } from '../../../../shared/components/tag-input/tag-input.component';
import { ImgUploadComponent } from '../../../../shared/components/img-upload/img-upload.component';

@Component({
    selector: 'app-admin-project-form',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, RteToolbarComponent, TagInputComponent, ImgUploadComponent],
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
            // Drop blank URLs so the backend's @IsUrl() validation isn't tripped by "".
            liveUrl: form.value.liveUrl?.trim() || undefined,
            githubUrl: form.value.githubUrl?.trim() || undefined,
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

    /** Receives an already-validated file from <app-img-upload> and uploads it. */
    onFileSelected(file: File) {
        this.uploadError.set(null);
        this.uploading.set(true);
        this.service.uploadImage(file).subscribe({
            next: ({ url }) => { this.thumbPreview.set(url); this.uploading.set(false); },
            error: () => { this.uploadError.set('Upload failed. Please try again.'); this.uploading.set(false); },
        });
    }
}
