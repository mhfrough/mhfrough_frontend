import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BlogsService } from '../../../../core/services/blogs.service';

@Component({
    selector: 'app-blog-detail',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './blog-detail.component.html',
})
export class BlogDetailComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private service = inject(BlogsService);
    readonly blog = signal<any>(null);
    readonly loading = signal(true);
    readonly notFound = signal(false);

    ngOnInit() {
        const slug = this.route.snapshot.paramMap.get('slug') ?? '';
        this.service.getBySlug(slug).subscribe({
            next: (data: any) => { this.blog.set(data); this.loading.set(false); },
            error: () => { this.notFound.set(true); this.loading.set(false); },
        });
    }
}
