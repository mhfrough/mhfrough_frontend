import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProjectsService } from '../../../../core/services/projects.service';
import { ImgFallbackDirective } from '../../../../shared/directives/img-fallback.directive';
import { ExternalUrlPipe } from '../../../../shared/pipes/external-url.pipe';

@Component({
    selector: 'app-project-detail',
    standalone: true,
    imports: [CommonModule, RouterLink, ImgFallbackDirective, ExternalUrlPipe],
    templateUrl: './project-detail.component.html',
})
export class ProjectDetailComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private service = inject(ProjectsService);

    readonly project = signal<any>(null);
    readonly loading = signal(true);

    ngOnInit() {
        const slug = this.route.snapshot.paramMap.get('slug') ?? '';
        // Try slug endpoint first; if it fails (not a valid slug), try by id
        this.service.getBySlug(slug).subscribe({
            next: (data: any) => { this.project.set(data); this.loading.set(false); },
            error: () => {
                // fallback: try by UUID id
                this.service.getOne(slug).subscribe({
                    next: (data: any) => { this.project.set(data); this.loading.set(false); },
                    error: () => {
                        this.router.navigate(['/not-found'], {
                            replaceUrl: true,
                            state: { from: `/projects/${slug}` },
                        });
                    },
                });
            },
        });
    }
}
