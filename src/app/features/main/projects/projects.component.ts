import { Component, OnInit, OnDestroy, inject, signal, HostListener, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ProjectsService } from '../../../core/services/projects.service';
import { RealtimeService } from '../../../core/services/realtime.service';

@Component({
    selector: 'app-projects',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './projects.component.html',
})
export class ProjectsComponent implements OnInit, OnDestroy {
    private projectsService = inject(ProjectsService);
    private platformId = inject(PLATFORM_ID);
    private readonly realtime = inject(RealtimeService);
    readonly projects = signal<any[]>([]);
    readonly loading = signal(true);
    readonly lightboxSrc = signal<string | null>(null);
    private subs = new Subscription();

    ngOnInit() {
        this.projectsService.getAll().subscribe({
            next: (data: any[]) => { this.projects.set(data); this.loading.set(false); },
            error: () => this.loading.set(false),
        });

        this.subs.add(this.realtime.on<any>('project:created').subscribe(project => {
            if (project.isPublished) {
                this.projects.update(list => [...list, project]);
            }
        }));

        this.subs.add(this.realtime.on<any>('project:updated').subscribe(project => {
            if (project.isPublished) {
                this.projects.update(list => {
                    const exists = list.some(p => p.id === project.id);
                    return exists ? list.map(p => p.id === project.id ? project : p) : [...list, project];
                });
            } else {
                this.projects.update(list => list.filter(p => p.id !== project.id));
            }
        }));

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
        this.closeLightbox();
    }
}
