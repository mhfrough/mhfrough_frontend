import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ProjectsService } from '../../../core/services/projects.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { Subscription } from 'rxjs';
import { RteToolbarComponent } from '../../../shared/components/rte-toolbar/rte-toolbar.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';

@Component({
    selector: 'app-admin-projects',
    standalone: true,
    imports: [CommonModule, FormsModule, RteToolbarComponent, ImgFallbackDirective],
    templateUrl: './admin-projects.component.html',
})
export class AdminProjectsComponent implements OnInit, OnDestroy {
    private service = inject(ProjectsService);
    private readonly realtime = inject(RealtimeService);
    readonly projects = signal<any[]>([]);
    readonly loading = signal(true);
    readonly saving = signal(false);
    readonly editing = signal<any>(null);
    readonly showForm = signal(false);
    readonly deleteTargetId = signal<string | null>(null);
    readonly statusModal = signal<{ id: string; title: string; reason: string } | null>(null);
    readonly thumbPreview = signal<string | null>(null);
    readonly uploading = signal(false);
    readonly dragOver = signal(false);
    readonly uploadError = signal<string | null>(null);
    private subs = new Subscription();

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
    }

    openNew() { this.editing.set(null); this.thumbPreview.set(null); this.uploadError.set(null); this.showForm.set(true); }

    edit(p: any) {
        this.editing.set({ ...p, techStack: p.techStack?.join(', ') });
        this.thumbPreview.set(p.thumbnail || null);
        this.uploadError.set(null);
        this.showForm.set(true);
    }

    cancel() { this.showForm.set(false); this.editing.set(null); this.thumbPreview.set(null); this.uploadError.set(null); }

    save(form: NgForm) {
        form.form.markAllAsTouched();
        if (form.invalid) return;
        this.saving.set(true);
        const payload = { ...form.value, techStack: form.value.techStack?.split(',').map((s: string) => s.trim()).filter(Boolean) };
        const obs = this.editing() ? this.service.update(this.editing().id, payload) : this.service.create(payload);
        obs.subscribe({ next: () => { this.cancel(); this.saving.set(false); } });
    }

    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }

    toggleFeatured(p: any) {
        const newVal = !p.featured;
        // optimistic update so the star flips immediately
        this.projects.update(list => list.map(x => x.id === p.id ? { ...x, featured: newVal } : x));
        this.service.patchFeatured(p.id, newVal).subscribe({
            error: () => {
                // revert on failure
                this.projects.update(list => list.map(x => x.id === p.id ? { ...x, featured: p.featured } : x));
            },
        });
    }

    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe();
    }

    openStatusModal(id: string) { this.statusModal.set({ id, title: 'Unpublish Project', reason: '' }); }
    cancelStatus() { this.statusModal.set(null); }
    setStatusReason(e: Event) {
        const val = (e.target as HTMLTextAreaElement).value;
        this.statusModal.update(m => m ? { ...m, reason: val } : null);
    }
    executeStatus() {
        const m = this.statusModal();
        if (!m) return;
        this.statusModal.set(null);
        this.service.unpublish(m.id, m.reason || undefined).subscribe();
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
                this.thumbPreview.set(url);
                this.uploading.set(false);
            },
            error: () => {
                this.uploadError.set('Upload failed. Please try again.');
                this.uploading.set(false);
            },
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
