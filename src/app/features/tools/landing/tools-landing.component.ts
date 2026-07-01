import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { TOOLS, ToolMeta } from '../tools.config';

@Component({
    selector: 'app-tools-landing',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './tools-landing.component.html',
    styleUrl: './tools-landing.component.scss',
})
export class ToolsLandingComponent implements OnInit {
    private readonly seo = inject(SeoService);

    // Live tools first, then the "coming soon" placeholders.
    readonly tools = computed<ToolMeta[]>(() => [
        ...TOOLS.filter(t => t.status === 'live'),
        ...TOOLS.filter(t => t.status !== 'live'),
    ]);

    ngOnInit(): void {
        this.seo.update({
            title: 'Dev Tools | Mohammad Hamza',
            description:
                'A growing toolbox of fast, free developer utilities — REM/PX and CSS unit converters, an HTML/CSS/JS minifier, a CSS ↔ SCSS converter and more.',
            url: '/tools',
            keywords: 'dev tools, css unit converter, rem to px, minifier, css to scss, web developer tools',
        });
    }
}
