import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { BlogsService } from '../../../core/services/blogs.service';

@Component({
    selector: 'app-admin-blogs',
    standalone: true,
    imports: [CommonModule, FormsModule],
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

    ngOnInit() { this.load(); }

    load() {
        this.service.getAllAdmin().subscribe({ next: (d: any[]) => { this.blogs.set(d); this.loading.set(false); } });
    }

    openNew() { this.editing.set(null); this.showForm.set(true); }

    edit(b: any) { this.editing.set({ ...b, tags: b.tags?.join(', ') }); this.showForm.set(true); }

    cancel() { this.showForm.set(false); this.editing.set(null); }

    save(form: NgForm) {
        form.form.markAllAsTouched();
        if (form.invalid) return;
        this.saving.set(true);
        const payload = { ...form.value, tags: form.value.tags?.split(',').map((s: string) => s.trim()).filter(Boolean) };
        const obs = this.editing() ? this.service.update(this.editing().id, payload) : this.service.create(payload);
        obs.subscribe({ next: () => { this.load(); this.cancel(); this.saving.set(false); } });
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
}
