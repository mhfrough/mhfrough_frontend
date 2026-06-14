import { Component, OnInit, AfterViewInit, OnDestroy, inject, signal, PLATFORM_ID, ElementRef } from '@angular/core';
import { isPlatformBrowser, CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProjectsService } from '../../../core/services/projects.service';
import { BlogsService } from '../../../core/services/blogs.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { FooterSettingsService } from '../../../core/services/footer-settings.service';
import { FeedbackService } from '../../../core/services/inquiry-feedback.service';
import { PreconnectService } from '../../../core/services/preconnect.service';
import { SeoService } from '../../../core/services/seo.service';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { ExternalUrlPipe } from '../../../shared/pipes/external-url.pipe';
import { SERVICES, FAQS } from '../../../core/data/site-content';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterLink, NgOptimizedImage, ImgFallbackDirective, ExternalUrlPipe],
    templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
    private projectsService = inject(ProjectsService);
    private blogsService = inject(BlogsService);
    private platformId = inject(PLATFORM_ID);
    private elRef = inject(ElementRef);
    private readonly realtime = inject(RealtimeService);
    readonly footerSettings = inject(FooterSettingsService);
    private feedbackService = inject(FeedbackService);
    private preconnect = inject(PreconnectService);
    private seo = inject(SeoService);
    readonly projects = signal<any[]>([]);
    readonly loadingProjects = signal(true);
    readonly recentBlogs = signal<any[]>([]);
    readonly loadingBlogs = signal(true);
    readonly featuredReviews = signal<any[]>([]);
    readonly loadingFeaturedReviews = signal(true);
    readonly greeting = signal('');
    readonly holidayGreeting = signal('');
    readonly openFaqItems = signal<number[]>([]);

    readonly stars = [1, 2, 3, 4, 5];

    readonly statsConfig = [
        { target: 6, suffix: '+', label: 'Years Experience' },
        { target: 30, suffix: '+', label: 'Projects Delivered' },
        { target: 10, suffix: '+', label: 'Happy Clients' },
        { target: 100, suffix: '%', label: 'On-time Delivery' },
    ];
    readonly statsDisplayed = signal(['6+', '30+', '10+', '100%']);
    private statsAnimated = false;
    private observers: IntersectionObserver[] = [];

    // Home shows only teasers; the full lists live on /services and /faq.
    readonly featuredServices = SERVICES.filter(s => s.featured);
    readonly topFaqs = FAQS.slice(0, 3);

    private subs = new Subscription();

    ngOnInit() {
        this.seo.update({
            title: 'Mohammad Hamza — Application Developer & Product Designer',
            description: 'Portfolio of Mohammad Hamza, an application developer and product designer crafting modern web experiences.',
            url: '/',
            type: 'profile',
        });
        // FAQ structured data lives on the dedicated /faq page now.
        this.footerSettings.load();
        this.projectsService.getFeatured().subscribe({
            next: (data: any[]) => { this.projects.set(data); this.loadingProjects.set(false); this.preconnect.add(data[0]?.thumbnail); },
            error: () => this.loadingProjects.set(false),
        });
        // Most recent post — the full archive lives on /blog.
        this.blogsService.getPublic(1, 1).subscribe({
            next: (res) => { this.recentBlogs.set(res.data); this.loadingBlogs.set(false); },
            error: () => this.loadingBlogs.set(false),
        });
        this.loadFeaturedReviews();
        this.buildGreeting();

        // project:created → append if published AND featured
        this.subs.add(this.realtime.on<any>('project:created').subscribe(project => {
            if (project.isPublished && project.featured) {
                this.projects.update(list => [...list, project]);
            }
        }));

        // project:updated → update in-place; remove if no longer published or no longer featured
        this.subs.add(this.realtime.on<any>('project:updated').subscribe(project => {
            if (project.isPublished && project.featured) {
                this.projects.update(list => {
                    const exists = list.some(p => p.id === project.id);
                    return exists ? list.map(p => p.id === project.id ? project : p) : [...list, project];
                });
            } else {
                this.projects.update(list => list.filter(p => p.id !== project.id));
            }
        }));

        // project:unpublished / deleted → remove from public list
        this.subs.add(this.realtime.on<{ id: string }>('project:unpublished').subscribe(({ id }) => {
            this.projects.update(list => list.filter(p => p.id !== id));
        }));
        this.subs.add(this.realtime.on<{ id: string }>('project:deleted').subscribe(({ id }) => {
            this.projects.update(list => list.filter(p => p.id !== id));
        }));

        // feedback realtime → keep featured reviews fresh
        this.subs.add(this.realtime.on<any>('feedback:approved').subscribe(() => this.loadFeaturedReviews()));
        this.subs.add(this.realtime.on<any>('feedback:unapproved').subscribe(() => this.loadFeaturedReviews()));
        this.subs.add(this.realtime.on<any>('feedback:deleted').subscribe(() => this.loadFeaturedReviews()));
        this.subs.add(this.realtime.on<any>('feedback:featured').subscribe(() => this.loadFeaturedReviews()));
    }

    ngAfterViewInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.setupScrollReveal();
        this.setupStatsObserver();
    }

    ngOnDestroy() {
        this.subs.unsubscribe();
        this.observers.forEach(o => o.disconnect());
        this.seo.removeJsonLd();
    }

    private loadFeaturedReviews() {
        this.loadingFeaturedReviews.set(true);
        this.feedbackService.getFeatured().subscribe({
            next: (data) => { this.featuredReviews.set(data); this.loadingFeaturedReviews.set(false); },
            error: () => this.loadingFeaturedReviews.set(false),
        });
    }

    toggleFaq(i: number) {
        const cur = this.openFaqItems();
        this.openFaqItems.set(cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i]);
    }

    private setupScrollReveal() {
        const host: HTMLElement = this.elRef.nativeElement;
        const targets = host.querySelectorAll<HTMLElement>('.section, .stats-strip, .hero');
        targets.forEach(el => el.classList.add('reveal'));

        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('reveal--visible');
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.08 });

        targets.forEach(el => obs.observe(el));
        this.observers.push(obs);
    }

    private setupStatsObserver() {
        const host: HTMLElement = this.elRef.nativeElement;
        const strip = host.querySelector('.stats-strip');
        if (!strip) return;

        const obs = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !this.statsAnimated) {
                this.statsAnimated = true;
                this.statsConfig.forEach((stat, i) => this.animateStat(i, stat.target, stat.suffix, i * 120));
                obs.disconnect();
            }
        }, { threshold: 0.4 });

        obs.observe(strip);
        this.observers.push(obs);
    }

    private animateStat(index: number, target: number, suffix: string, delay: number) {
        setTimeout(() => {
            const total = 300;
            const start = performance.now();

            const tick = () => {
                const elapsed = performance.now() - start;
                if (elapsed >= total) {
                    this.statsDisplayed.update(arr => { const c = [...arr]; c[index] = target + suffix; return c; });
                    return;
                }
                const eased = 1 - Math.pow(1 - elapsed / total, 3);
                const val = Math.round(eased * target);
                this.statsDisplayed.update(arr => { const c = [...arr]; c[index] = val + suffix; return c; });
                requestAnimationFrame(tick);
            };

            requestAnimationFrame(tick);
        }, delay);
    }

    private pick(arr: string[], seed: number): string {
        return arr[seed % arr.length];
    }

    private buildGreeting() {
        const now = new Date();
        const h = now.getHours();
        const day = now.getDay();       // 0 Sun … 6 Sat
        const month = now.getMonth() + 1;
        const date = now.getDate();
        // Use date as seed so the greeting is stable for the whole day
        const seed = now.getDate() + now.getMonth() * 31;

        // ── Check holiday / special day first ────────────────────────
        const holiday = this.detectHoliday(month, date);
        this.holidayGreeting.set(holiday);

        // ── Weekday specials ──────────────────────────────────────────
        if (day === 5) { // Friday
            this.greeting.set(this.pick(['Happy Friday', 'TGIF', 'It\'s Friday!'], seed));
            return;
        }
        if (day === 1) { // Monday
            this.greeting.set(this.pick(['Happy Monday', 'New week, new goals', 'Morning, Monday'], seed));
            return;
        }
        if (day === 0 || day === 6) { // Weekend
            this.greeting.set(this.pick(['Happy weekend', 'Enjoy the weekend', 'Weekend vibes'], seed));
            return;
        }

        // ── Season ────────────────────────────────────────────────────
        const season = this.getSeason(month, date);

        // ── Time of day pools ─────────────────────────────────────────
        let pool: string[];
        if (h >= 5 && h < 12) {
            pool = [
                'Good morning', 'Rise and shine', 'Morning', 'Hey, good morning',
                `Good ${season} morning`, 'Top of the morning',
            ];
        } else if (h >= 12 && h < 14) {
            pool = ['Good noon', 'Good day', 'Happy noon', 'Hello there'];
        } else if (h >= 14 && h < 17) {
            pool = [
                'Good afternoon', 'Hey', 'Hello', 'Greetings',
                `Good ${season} afternoon`, 'Hi there',
            ];
        } else if (h >= 17 && h < 21) {
            pool = [
                'Good evening', 'Hey there', 'Evening', `Good ${season} evening`,
                'Hello', 'Lovely evening',
            ];
        } else {
            pool = [
                'Late night vibes', 'Burning the midnight oil?',
                'Hello, night owl', 'Hey', 'Still up?',
            ];
        }

        this.greeting.set(this.pick(pool, seed));
    }

    private getSeason(month: number, day: number): string {
        // Northern hemisphere seasons
        if ((month === 12 && day >= 21) || month <= 2 || (month === 3 && day < 20)) return 'winter';
        if ((month === 3 && day >= 20) || month <= 5 || (month === 6 && day < 21)) return 'spring';
        if ((month === 6 && day >= 21) || month <= 8 || (month === 9 && day < 23)) return 'summer';
        return 'autumn';
    }

    private detectHoliday(month: number, day: number): string {
        const map: Record<string, string> = {
            '1-1': '🎊 Happy New Year!',
            '2-14': '❤️ Happy Valentine\'s Day!',
            '3-8': '🌸 Happy Women\'s Day!',
            '3-20': '🌱 Welcome Spring!',
            '3-22': '💧 World Water Day',
            '4-1': '😄 Happy April Fool\'s Day!',
            '4-22': '🌎 Happy Earth Day!',
            '6-5': '🌱 Happy Environment Day!',
            '6-8': '🌊 World Oceans Day',
            '6-21': '☀️ Welcome Summer!',
            '6-23': '🎉 It\'s my birthday! Celebrate with me!',
            '7-30': '🤝 International Friendship Day',
            '8-14': '🟢 Happy Independence Day!',
            '9-5': '💝 International Day of Charity',
            '9-21': '🕊️ International Peace Day',
            '10-1': '☕ Happy International Coffee Day!',
            '10-31': '🎃 Happy Halloween!',
            '12-25': '🎄 Merry Christmas!',
            '12-31': '🎉 Happy New Year\'s Eve!',
        };
        return map[`${month}-${day}`] ?? '';
    }
}
