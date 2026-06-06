import { Component, OnInit, OnDestroy, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BlogsService } from '../../../../core/services/blogs.service';
import { UserInfoService } from '../../../../core/services/user-info.service';
import { RealtimeService } from '../../../../core/services/realtime.service';
import { PreconnectService } from '../../../../core/services/preconnect.service';
import { RteToolbarComponent } from '../../../../shared/components/rte-toolbar/rte-toolbar.component';
import { ImgFallbackDirective } from '../../../../shared/directives/img-fallback.directive';
import { FrontToastService } from '../../../../core/services/front-toast.service';
import { Title } from '@angular/platform-browser';
import { EditorHelperService } from '../../../../core/services/editor-helper.service';
import { VisitorTrackingService } from '../../../../core/services/visitor-tracking.service';

@Component({
    selector: 'app-blog-detail',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule, NgOptimizedImage, RteToolbarComponent, ImgFallbackDirective],
    templateUrl: './blog-detail.component.html',
})
export class BlogDetailComponent implements OnInit, OnDestroy {
    private editor = inject(EditorHelperService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private service = inject(BlogsService);
    private userInfo = inject(UserInfoService);
    private readonly realtime = inject(RealtimeService);
    private preconnect = inject(PreconnectService);
    private toast = inject(FrontToastService);
    private tracking = inject(VisitorTrackingService);
    private titleService = inject(Title);
    private platformId = inject(PLATFORM_ID);

    readonly blog = signal<any>(null);
    readonly loading = signal(true);
    readonly notFound = signal(false);

    readonly comments = signal<any[]>([]);
    readonly commentCount = signal(0);
    readonly commentSending = signal(false);
    readonly commentError = signal('');
    readonly commentSuccess = signal(false);

    commentData = { authorName: '', authorEmail: '', content: '' };
    private subs = new Subscription();
    private pendingReviewToastId: number | null = null;

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
                this.titleService.setTitle(`${data.title} | Mohammad Hamza`);
                this.loading.set(false);
                this.preconnect.add(data?.coverImage);
                this.tracking.trackEvent('blog_read', { title: data.title, slug: data.slug ?? '' });
                this.loadComments(data.id);
                this.subscribeToRealtimeEvents(data.id);
                this.subscribeToCommentEvents(data.id);
            },
            error: () => {
                const originalUrl = this.route.snapshot.url.map(s => s.path).join('/');
                this.router.navigate(['/not-found'], {
                    replaceUrl: true,
                    state: { from: `/${originalUrl}` },
                });
            },
        });
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    private subscribeToRealtimeEvents(blogId: string) {
        // Blog updated in-place (e.g. content, title edited)
        this.subs.add(this.realtime.on<any>('blog:updated').subscribe(blog => {
            if (blog.id !== this.blog()?.id) return;
            this.blog.set(blog);
            this.titleService.setTitle(`${blog.title} | Mohammad Hamza`);
        }));

        // Blog unpublished or deleted → redirect away
        const redirectAway = ({ id }: { id: string }) => {
            if (id !== this.blog()?.id) return;
            this.router.navigate(['/blog'], { replaceUrl: true });
        };
        this.subs.add(this.realtime.on<{ id: string }>('blog:unpublished').subscribe(redirectAway));
        this.subs.add(this.realtime.on<{ id: string }>('blog:deleted').subscribe(redirectAway));
    }

    private subscribeToCommentEvents(blogId: string) {
        // Admin approved a comment → append to visible comments
        this.subs.add(this.realtime.on<any>('comment:approved').subscribe(comment => {
            if (comment.blogId !== blogId) return;
            // Dismiss the "pending review" toast since comment is now visible
            if (this.pendingReviewToastId !== null) {
                this.toast.dismiss(this.pendingReviewToastId);
                this.pendingReviewToastId = null;
            }
            this.comments.update(list => {
                const exists = list.some(c => c.id === comment.id);
                return exists ? list.map(c => c.id === comment.id ? comment : c) : [...list, comment];
            });
            this.commentCount.set(this.comments().length);
        }));

        // Admin unapproved or deleted → remove from visible list
        this.subs.add(this.realtime.on<{ id: string; blogId: string }>('comment:unapproved').subscribe(({ id, blogId: bid }) => {
            if (bid !== blogId) return;
            this.comments.update(list => list.filter(c => c.id !== id));
            this.commentCount.set(this.comments().length);
        }));

        this.subs.add(this.realtime.on<{ id: string; blogId: string }>('comment:deleted').subscribe(({ id, blogId: bid }) => {
            if (bid !== blogId) return;
            this.comments.update(list => list.filter(c => c.id !== id));
            this.commentCount.set(this.comments().length);
        }));
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
        form.form.markAllAsTouched();
        if (form.invalid) return;
        this.commentSending.set(true);
        this.commentError.set('');
        this.commentSuccess.set(false);
        const { authorName, authorEmail, content } = this.commentData;
        this.service.submitComment(this.blog().id, { authorName, authorEmail, content }).subscribe({
            next: () => {
                this.userInfo.save({ name: authorName, email: authorEmail });
                this.commentSuccess.set(true);
                this.commentSending.set(false);
                this.commentData.content = '';
                form.resetForm({ authorName, authorEmail, content: '' });
                if (isPlatformBrowser(this.platformId)) {
                    setTimeout(() => {
                        document.getElementById('blog-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                }
            },
            error: () => {
                this.commentError.set('Failed to submit. Please try again.');
                this.commentSending.set(false);
            },
        });
    }

    format(el: HTMLTextAreaElement, open: string, close: string): void {
        this.editor.format(el, open, close);
        this.commentData.content = el.value;
    }
}
