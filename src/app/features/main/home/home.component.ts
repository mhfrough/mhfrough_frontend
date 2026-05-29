import { Component, OnInit, OnDestroy, inject, signal, HostListener, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ProjectsService } from '../../../core/services/projects.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { FooterSettingsService } from '../../../core/services/footer-settings.service';
import { PreconnectService } from '../../../core/services/preconnect.service';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { ExternalUrlPipe } from '../../../shared/pipes/external-url.pipe';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterLink, NgOptimizedImage, ImgFallbackDirective, ExternalUrlPipe],
    templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, OnDestroy {
    private projectsService = inject(ProjectsService);
    private platformId = inject(PLATFORM_ID);
    private readonly realtime = inject(RealtimeService);
    readonly footerSettings = inject(FooterSettingsService);
    private preconnect = inject(PreconnectService);
    private titleService = inject(Title);
    readonly projects = signal<any[]>([]);
    readonly loadingProjects = signal(true);
    readonly greeting = signal('');
    readonly holidayGreeting = signal('');
    readonly lightboxSrc = signal<string | null>(null);
    readonly clients = [
        { name: 'Arittek Solutions (Pvt.) Ltd.', logo: '/clients/arittek.png', url: 'https://arittek.com/' },
        { name: 'Befiler', logo: '/clients/befiler.png', url: 'https://www.befiler.com/' },
        { name: 'Bloomstone Private Resort', logo: '/clients/bloomstone.png', url: 'https://bloomstone-frontend.onrender.com/' },
        { name: 'Finclore', logo: '/clients/finclore.png', url: 'https://www.finclore.com/' },
    ];
    readonly marqueeClients = [...this.clients, ...this.clients];
    private subs = new Subscription();

    ngOnInit() {
        this.titleService.setTitle('Mohammad Hamza — Application Developer & Product Designer');
        this.footerSettings.load();
        this.projectsService.getFeatured().subscribe({
            next: (data: any[]) => { this.projects.set(data); this.loadingProjects.set(false); this.preconnect.add(data[0]?.thumbnail); },
            error: () => this.loadingProjects.set(false),
        });
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
    }

    ngOnDestroy() {
        this.subs.unsubscribe();
        this.closeLightbox();
    }

    openLightbox(src: string) {
        this.lightboxSrc.set(src);
        if (isPlatformBrowser(this.platformId)) {
            document.body.style.overflow = 'hidden';
        }
    }

    closeLightbox() {
        this.lightboxSrc.set(null);
        if (isPlatformBrowser(this.platformId)) {
            document.body.style.overflow = '';
        }
    }

    @HostListener('document:keydown.escape')
    onEscape() {
        if (this.lightboxSrc()) this.closeLightbox();
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
            '1-1': '🎆 Happy New Year!',
            '2-14': '❤️ Happy Valentine\'s Day!',
            '3-8': '🌸 Happy Women\'s Day!',
            '4-1': '😄 Happy April Fool\'s Day!',
            '5-1': '🌍 Happy Labour Day!',
            '6-5': '🌱 Happy Environment Day!',
            '6-21': '☀️ Welcome Summer!',
            '6-23': '🎉 It\'s my birthday! Celebrate with me!',
            '8-14': '🟢 Happy Independence Day!',
            '10-31': '🎃 Happy Halloween!',
            '12-25': '🎄 Merry Christmas!',
            '12-31': '🎉 Happy New Year\'s Eve!',
        };
        return map[`${month}-${day}`] ?? '';
    }
}
