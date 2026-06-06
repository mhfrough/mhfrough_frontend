import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProjectsService } from '../../../../core/services/projects.service';
import { ImgFallbackDirective } from '../../../../shared/directives/img-fallback.directive';
import { ExternalUrlPipe } from '../../../../shared/pipes/external-url.pipe';
import { PreconnectService } from '../../../../core/services/preconnect.service';
import { VisitorTrackingService } from '../../../../core/services/visitor-tracking.service';
import { Title } from '@angular/platform-browser';

@Component({
    selector: 'app-project-detail',
    standalone: true,
    imports: [CommonModule, RouterLink, NgOptimizedImage, ImgFallbackDirective, ExternalUrlPipe],
    templateUrl: './project-detail.component.html',
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private service = inject(ProjectsService);
    private preconnect = inject(PreconnectService);
    private tracking = inject(VisitorTrackingService);
    private titleService = inject(Title);

    readonly project = signal<any>(null);
    readonly loading = signal(true);
    private subs = new Subscription();

    ngOnDestroy() { this.subs.unsubscribe(); }

    ngOnInit() {
        const slug = this.route.snapshot.paramMap.get('slug') ?? '';
        // Try slug endpoint first; if it fails (not a valid slug), try by id
        this.subs.add(this.service.getBySlug(slug).subscribe({
            next: (data: any) => { this.project.set(data); this.titleService.setTitle(`${data.title} | Mohammad Hamza`); this.loading.set(false); this.preconnect.add(data?.thumbnail); this.tracking.trackEvent('project_view', { title: data.title, slug: data.slug ?? slug }); },
            error: () => {
                // fallback: try by UUID id
                this.subs.add(this.service.getOne(slug).subscribe({
                    next: (data: any) => { this.project.set(data); this.titleService.setTitle(`${data.title} | Mohammad Hamza`); this.loading.set(false); this.preconnect.add(data?.thumbnail); this.tracking.trackEvent('project_view', { title: data.title, slug: data.slug ?? slug }); },
                    error: () => {
                        this.router.navigate(['/not-found'], {
                            replaceUrl: true,
                            state: { from: `/projects/${slug}` },
                        });
                    },
                }));
            },
        }));
    }
}
