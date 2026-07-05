import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

    readonly search = signal('');
    readonly category = signal('All');

    readonly categories: string[] = ['All', ...Array.from(new Set(TOOLS.map(t => t.category)))];

    // Live tools first, then any "coming soon" placeholders, filtered by
    // search text (name + desc) and the selected category chip.
    readonly tools = computed<ToolMeta[]>(() => {
        const q = this.search().trim().toLowerCase();
        const cat = this.category();
        return [
            ...TOOLS.filter(t => t.status === 'live'),
            ...TOOLS.filter(t => t.status !== 'live'),
        ].filter(t =>
            (cat === 'All' || t.category === cat) &&
            (!q || t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)),
        );
    });

    readonly totalCount = TOOLS.length;

    ngOnInit(): void {
        this.seo.update({
            title: 'Dev Tools | Mohammad Hamza',
            description:
                'A growing toolbox of fast, free developer utilities — CSS converters, minifier, image tools, colour palettes, generators, codecs, JSON, regex, diff and more.',
            url: '/tools',
            keywords: 'dev tools, css unit converter, minifier, json formatter, regex tester, diff checker, uuid generator, web developer tools',
        });
    }
}
