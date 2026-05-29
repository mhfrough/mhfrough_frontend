import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ProjectsService } from '../../../core/services/projects.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { EditorHelperService } from '../../../core/services/editor-helper.service';
import { AdminListBase } from '../../../shared/admin-list.base';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ReasonModalComponent } from '../../../shared/components/reason-modal/reason-modal.component';
import { ImgUploadComponent } from '../../../shared/components/img-upload/img-upload.component';
import { RteToolbarComponent } from '../../../shared/components/rte-toolbar/rte-toolbar.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { TagInputComponent } from '../../../shared/components/tag-input/tag-input.component';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-admin-projects',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        PaginationComponent, ConfirmModalComponent, ReasonModalComponent, ImgUploadComponent,
        RteToolbarComponent, ImgFallbackDirective, TagInputComponent,
    ],
    templateUrl: './admin-projects.component.html',
})
export class AdminProjectsComponent extends AdminListBase implements OnInit, OnDestroy {
    private service = inject(ProjectsService);
    private readonly realtime = inject(RealtimeService);
    readonly editor = inject(EditorHelperService);

    readonly projects = signal<any[]>([]);
    readonly loading = signal(true);
    readonly saving = signal(false);
    readonly editing = signal<any>(null);
    readonly showForm = signal(false);
    readonly statusModal = signal<{ id: string; title: string } | null>(null);
    readonly thumbPreview = signal<string | null>(null);
    readonly uploading = signal(false);
    readonly uploadError = signal<string | null>(null);
    readonly allTags = signal<string[]>([]);
    readonly formTags = signal<string[]>([]);
    private subs = new Subscription();

    readonly filteredProjects = computed(() => {
        const q = this.searchQuery().toLowerCase().trim();
        const sorted = [...this.projects()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        if (!q) return sorted;
        return sorted.filter(p =>
            p.title?.toLowerCase().includes(q) ||
            p.techStack?.some((t: string) => t.toLowerCase().includes(q))
        );
    });

    readonly pagedProjects = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.filteredProjects().slice(start, start + this.pageSize());
    });

    override readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredProjects().length / this.pageSize()))
    );

    ngOnInit() {
        this.load();

        // project:created → prepend to list
        this.subs.add(this.realtime.on<any>('project:created').subscribe(project => {
            this.projects.update(list => [project, ...list]);
        }));

        // project:updated → update in-place
        this.subs.add(this.realtime.on<any>('project:updated').subscribe(project => {
            this.projects.update(list => list.map(p => p.id === project.id ? project : p));
        }));

        // project:unpublished → update isPublished flag in-place
        this.subs.add(this.realtime.on<{ id: string }>('project:unpublished').subscribe(({ id }) => {
            this.projects.update(list => list.map(p => p.id === id ? { ...p, isPublished: false } : p));
        }));

        // project:deleted → remove from list
        this.subs.add(this.realtime.on<{ id: string }>('project:deleted').subscribe(({ id }) => {
            this.projects.update(list => list.filter(p => p.id !== id));
        }));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    load() {
        this.service.getAllAdmin().subscribe({ next: (d: any[]) => { this.projects.set(d); this.loading.set(false); } });
        this.service.getTags().subscribe({ next: t => this.allTags.set(t) });
    }

    openNew() { this.editing.set(null); this.thumbPreview.set(null); this.uploadError.set(null); this.formTags.set([]); this.showForm.set(true); }

    edit(p: any) {
        this.editing.set({ ...p, techStack: p.techStack?.join(', ') });
        this.thumbPreview.set(p.thumbnail || null);
        this.formTags.set(p.tags ? [...p.tags] : []);
        this.uploadError.set(null);
        this.showForm.set(true);
    }

    cancel() { this.showForm.set(false); this.editing.set(null); this.thumbPreview.set(null); this.uploadError.set(null); this.formTags.set([]); }

    save(form: NgForm) {
        form.form.markAllAsTouched();
        if (form.invalid) return;
        this.saving.set(true);
        const payload = {
            ...form.value,
            tags: this.formTags(),
            techStack: form.value.techStack?.split(',').map((s: string) => s.trim()).filter(Boolean),
        };
        const obs = this.editing() ? this.service.update(this.editing().id, payload) : this.service.create(payload);
        obs.subscribe({ next: () => { this.cancel(); this.saving.set(false); } });
    }

    toggleFeatured(p: any) {
        const newVal = !p.featured;
        this.projects.update(list => list.map(x => x.id === p.id ? { ...x, featured: newVal } : x));
        this.service.patchFeatured(p.id, newVal).subscribe({
            error: () => {
                this.projects.update(list => list.map(x => x.id === p.id ? { ...x, featured: p.featured } : x));
            },
        });
    }

    override executeDelete(): void {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe();
    }

    openStatusModal(id: string): void { this.statusModal.set({ id, title: 'Unpublish Project' }); }
    cancelStatus(): void { this.statusModal.set(null); }
    executeStatus(reason: string): void {
        const m = this.statusModal();
        if (!m) return;
        this.statusModal.set(null);
        this.service.unpublish(m.id, reason || undefined).subscribe();
    }

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
        const list = [...this.projects()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const src = list.find(p => p.id === srcId);
        const tgt = list.find(p => p.id === targetId);
        if (!src || !tgt) { return; }
        const srcOrd = src.sortOrder ?? 0;
        const tgtOrd = tgt.sortOrder ?? 0;
        this.projects.update(li => li.map(p => {
            if (p.id === srcId) return { ...p, sortOrder: tgtOrd };
            if (p.id === targetId) return { ...p, sortOrder: srcOrd };
            return p;
        }));
        this.service.reorder([
            { id: srcId, sortOrder: tgtOrd },
            { id: targetId, sortOrder: srcOrd },
        ]).subscribe({ error: () => this.load() });
    }

    format(el: HTMLTextAreaElement, open: string, close: string): void { this.editor.format(el, open, close); }
    insertLink(el: HTMLTextAreaElement): void { this.editor.insertLink(el); }

    onFileSelected(file: File): void {
        this.uploadError.set(null);
        this.uploading.set(true);
        this.service.uploadImage(file).subscribe({
            next: ({ url }) => { this.thumbPreview.set(url); this.uploading.set(false); },
            error: () => { this.uploadError.set('Upload failed. Please try again.'); this.uploading.set(false); },
        });
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
}
