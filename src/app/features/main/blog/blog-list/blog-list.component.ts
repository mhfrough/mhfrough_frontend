import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BlogsService } from '../../../../core/services/blogs.service';
import { ImgFallbackDirective } from '../../../../shared/directives/img-fallback.directive';

@Component({
    selector: 'app-blog-list',
    standalone: true,
    imports: [CommonModule, RouterLink, ImgFallbackDirective],
    templateUrl: './blog-list.component.html',
})
export class BlogListComponent implements OnInit {
    private service = inject(BlogsService);
    readonly blogs = signal<any[]>([]);
    readonly loading = signal(true);

    ngOnInit() {
        this.service.getAll().subscribe({
            next: (data: any[]) => { this.blogs.set(data); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
    }
}
