import { Component, OnInit, OnDestroy, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { Subscription, skip } from 'rxjs';
import { BlogsService } from '../../../../core/services/blogs.service';
import { UserInfoService } from '../../../../core/services/user-info.service';
import { RealtimeService } from '../../../../core/services/realtime.service';
import { PreconnectService } from '../../../../core/services/preconnect.service';
import { RteToolbarComponent } from '../../../../shared/components/rte-toolbar/rte-toolbar.component';
import { ImgFallbackDirective } from '../../../../shared/directives/img-fallback.directive';
import { FrontToastService } from '../../../../core/services/front-toast.service';
import { NetworkStatusService } from '../../../../core/services/network-status.service';
import { Title, DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SeoService } from '../../../../core/services/seo.service';
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
    private seo = inject(SeoService);
    private sanitizer = inject(DomSanitizer);
    private platformId = inject(PLATFORM_ID);
    readonly network = inject(NetworkStatusService);

    readonly blog = signal<any>(null);
    readonly loading = signal(true);
    readonly notFound = signal(false);

    readonly tocHtml = signal<SafeHtml>('');
    readonly toc = signal<{ id: string; text: string; level: number }[]>([]);
    readonly activeId = signal<string | null>(null);
    readonly tocOpen = signal(false);
    readonly related = signal<any[]>([]);
    readonly recentPosts = signal<any[]>([]);
    private observer?: IntersectionObserver;
    private readonly intersecting = new Map<string, boolean>();

    readonly comments = signal<any[]>([]);
    readonly commentCount = signal(0);
    readonly commentSending = signal(false);
    readonly commentError = signal('');
    readonly commentSuccess = signal(false);
    readonly commentQueued = signal(false);

    commentData = { authorName: '', authorEmail: '', content: '' };
    private subs = new Subscription();
    private pendingReviewToastId: number | null = null;

    ngOnInit() {
        const saved = this.userInfo.get();
        if (saved) {
            this.commentData.authorName = saved.name ?? '';
            this.commentData.authorEmail = saved.email ?? '';
        }

        const skipInitial = this.network.isOnline() ? 1 : 0;
        this.subs.add(this.network.online$.pipe(skip(skipInitial)).subscribe(() => {
            if (this.commentQueued()) {
                this.commentQueued.set(false);
                this.commentSuccess.set(true);
                if (isPlatformBrowser(this.platformId)) {
                    setTimeout(() => {
                        document.getElementById('blog-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                }
            }
        }));

        const slug = this.route.snapshot.paramMap.get('slug') ?? '';
        this.service.getBySlug(slug).subscribe({
            next: (data: any) => {
                this.applyContent(data);
                this.applySeo(data);
                this.loading.set(false);
                this.preconnect.add(data?.coverImage);
                this.tracking.trackEvent('blog_read', { title: data.title, slug: data.slug ?? '' });
                this.loadComments(data.id);
                this.loadRelated(data.slug);
                this.loadRecent(data.slug);
                this.subscribeToRealtimeEvents(data.id);
                this.subscribeToCommentEvents(data.id);
                if (isPlatformBrowser(this.platformId)) {
                    this.scheduleScrollSpy();
                }
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

    ngOnDestroy() {
        this.subs.unsubscribe();
        this.observer?.disconnect();
        this.seo.removeJsonLd();
    }

    private applyContent(blog: any): void {
        this.blog.set(blog);
        const { html, toc } = this.buildToc(blog.content || '');
        // Trusted, admin-authored content — bypass sanitization so the ids we
        // just injected (stripped by the default [innerHTML] sanitizer) survive.
        this.tocHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
        this.toc.set(toc);
    }

    private loadRelated(slug: string) {
        this.service.getRelated(slug).subscribe({ next: (list: any[]) => this.related.set(list) });
    }

    private loadRecent(slug: string) {
        this.service.getPublic(1, 5).subscribe({
            next: (res: any) => this.recentPosts.set((res.data ?? []).filter((p: any) => p.slug !== slug).slice(0, 4)),
        });
    }

    private slugify(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/[\s_]+/g, '-')
            .replace(/-+/g, '-');
    }

    /** Injects unique ids into <h2>/<h3> tags in the raw content HTML and collects a TOC list.
     *  Pure string transform — runs identically on the server and in the browser (no DOM APIs). */
    private buildToc(html: string): { html: string; toc: { id: string; text: string; level: number }[] } {
        const toc: { id: string; text: string; level: number }[] = [];
        const used = new Set<string>();
        const output = html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, inner) => {
            const text = inner.replace(/<[^>]+>/g, '').trim();
            if (!text) return match;
            const base = this.slugify(text) || `section-${toc.length + 1}`;
            let unique = base;
            let i = 2;
            while (used.has(unique)) unique = `${base}-${i++}`;
            used.add(unique);
            toc.push({ id: unique, text, level: Number(level) });
            const cleanAttrs = attrs.replace(/\s+id="[^"]*"/i, '');
            return `<h${level}${cleanAttrs} id="${unique}">${inner}</h${level}>`;
        });
        return { html: output, toc };
    }

    /** Registers the observer only after the browser has actually painted the
     *  new content — a fixed setTimeout races against Angular's render timing. */
    private scheduleScrollSpy(): void {
        requestAnimationFrame(() => requestAnimationFrame(() => this.setupScrollSpy()));
    }

    private setupScrollSpy(): void {
        this.observer?.disconnect();
        this.intersecting.clear();
        const headings = Array.from(
            document.querySelectorAll<HTMLElement>('.blog-detail-content h2[id], .blog-detail-content h3[id]'),
        );
        if (!headings.length) return;
        this.observer = new IntersectionObserver(
            entries => {
                // `entries` is only the delta batch (elements that just crossed a
                // threshold) — track intersection state persistently across all
                // observed headings so an already-visible one further up isn't
                // dropped just because it didn't fire in this particular batch.
                for (const entry of entries) this.intersecting.set(entry.target.id, entry.isIntersecting);
                const topVisible = headings
                    .filter(h => this.intersecting.get(h.id))
                    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
                if (topVisible) this.activeId.set(topVisible.id);
            },
            { rootMargin: '-88px 0px -70% 0px', threshold: 0 },
        );
        headings.forEach(h => this.observer!.observe(h));
    }

    private applySeo(blog: any): void {
        this.titleService.setTitle(`${blog.title} | Mohammad Hamza`);
        this.seo.update({
            title: `${blog.title} | Mohammad Hamza`,
            description: blog.excerpt || blog.title,
            url: `/blog/${blog.slug}`,
            image: blog.coverImage,
            type: 'article',
        });
        this.seo.setJsonLd({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: blog.title,
            description: blog.excerpt || blog.title,
            image: blog.coverImage ? [blog.coverImage] : undefined,
            datePublished: blog.publishedAt,
            dateModified: blog.updatedAt ?? blog.publishedAt,
            author: { '@type': 'Person', name: 'Mohammad Hamza' },
        });
    }

    private subscribeToRealtimeEvents(blogId: string) {
        // Blog updated in-place (e.g. content, title edited)
        this.subs.add(this.realtime.on<any>('blog:updated').subscribe(blog => {
            if (blog.id !== this.blog()?.id) return;
            this.applyContent(blog);
            this.applySeo(blog);
            if (isPlatformBrowser(this.platformId)) {
                this.scheduleScrollSpy();
            }
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
        this.commentQueued.set(false);
        const { authorName, authorEmail, content } = this.commentData;
        this.service.submitComment(this.blog().id, { authorName, authorEmail, content }).subscribe({
            next: (res: any) => {
                this.userInfo.save({ name: authorName, email: authorEmail });
                this.tracking.trackEvent('blog_comment', { slug: this.blog().slug ?? '', title: this.blog().title ?? '' });
                this.commentSending.set(false);
                this.commentData.content = '';
                form.resetForm({ authorName, authorEmail, content: '' });
                if (res?.queued) {
                    this.commentQueued.set(true);
                } else {
                    this.commentSuccess.set(true);
                }
                if (isPlatformBrowser(this.platformId)) {
                    setTimeout(() => {
                        document.getElementById('comment-form-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                }
            },
            error: () => {
                this.commentError.set('Failed to submit. Please try again.');
                this.commentSending.set(false);
            },
        });
    }

    scrollToHeading(id: string, event: Event): void {
        // Angular's <base href="/"> makes plain <a href="#id"> resolve against
        // "/" instead of the current path, so it would navigate home instead
        // of jumping to the section — handle it manually.
        event.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
        // Set eagerly rather than waiting on the IntersectionObserver — a smooth
        // scroll takes a few hundred ms and the user already told us the target.
        this.activeId.set(id);
    }

    format(el: HTMLTextAreaElement, open: string, close: string): void {
        this.editor.format(el, open, close);
        this.commentData.content = el.value;
    }
}
