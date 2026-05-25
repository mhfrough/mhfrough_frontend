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

    ngOnInit() { this.load(); }

    load() {
        this.service.getAllAdmin().subscribe({ next: (d: any[]) => { this.blogs.set(d); this.loading.set(false); } });
    }

    openNew() { this.editing.set(null); this.showForm.set(true); }

    edit(b: any) { this.editing.set({ ...b, tags: b.tags?.join(', ') }); this.showForm.set(true); }

    cancel() { this.showForm.set(false); this.editing.set(null); }

    save(form: NgForm) {
        if (form.invalid) return;
        this.saving.set(true);
        const payload = { ...form.value, tags: form.value.tags?.split(',').map((s: string) => s.trim()).filter(Boolean) };
        const obs = this.editing() ? this.service.update(this.editing().id, payload) : this.service.create(payload);
        obs.subscribe({ next: () => { this.load(); this.cancel(); this.saving.set(false); } });
    }

    remove(id: string) {
        if (!confirm('Delete this post?')) return;
        this.service.remove(id).subscribe(() => this.load());
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
