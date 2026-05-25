import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { BlogsService } from '../../../../core/services/blogs.service';
import { UserInfoService } from '../../../../core/services/user-info.service';

@Component({
    selector: 'app-blog-detail',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule],
    templateUrl: './blog-detail.component.html',
})
export class BlogDetailComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private service = inject(BlogsService);
    private userInfo = inject(UserInfoService);

    readonly blog = signal<any>(null);
    readonly loading = signal(true);
    readonly notFound = signal(false);

    readonly comments = signal<any[]>([]);
    readonly commentCount = signal(0);
    readonly commentSending = signal(false);
    readonly commentSent = signal(false);
    readonly commentError = signal('');

    commentData = { authorName: '', authorEmail: '', content: '' };

    ngOnInit() {
        const saved = this.userInfo.get();
        if (saved) {
            this.commentData.authorName = saved.name ?? '';
            this.commentData.authorEmail = saved.email ?? '';
        }

        const slug = this.route.snapshot.paramMap.get('slug') ?? '';
        this.service.getBySlug(slug).subscribe({
            next: (data: any) => {
                this.blog.set(data);
                this.loading.set(false);
                this.loadComments(data.id);
            },
            error: () => { this.notFound.set(true); this.loading.set(false); },
        });
    }

    private loadComments(blogId: string) {
        this.service.getComments(blogId).subscribe({
            next: (list: any[]) => {
                this.comments.set(list);
                this.commentCount.set(list.length);
            },
        });
    }

    submitComment(form: NgForm) {
        if (form.invalid) return;
        this.commentSending.set(true);
        this.commentError.set('');
        const { authorName, authorEmail, content } = this.commentData;
        this.service.submitComment(this.blog().id, { authorName, authorEmail, content }).subscribe({
            next: () => {
                this.userInfo.save({ name: authorName, email: authorEmail });
                this.commentSent.set(true);
                this.commentSending.set(false);
                this.commentData.content = '';
                form.resetForm({ authorName, authorEmail, content: '' });
            },
            error: () => {
                this.commentError.set('Failed to submit. Please try again.');
                this.commentSending.set(false);
            },
        });
    }

    format(el: HTMLTextAreaElement, open: string, close: string): void {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const sel = el.value.substring(start, end);
        const replacement = open + (sel || 'text') + close;
        el.setRangeText(replacement, start, end, 'select');
        el.focus();
        el.dispatchEvent(new Event('input'));
        // sync ngModel
        this.commentData.content = el.value;
    }
}
