import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FooterSettingsService } from '../../../core/services/footer-settings.service';
import { SeoService } from '../../../core/services/seo.service';
import { ExternalUrlPipe } from '../../../shared/pipes/external-url.pipe';
import { TECH_STACK } from '../../../core/data/site-content';

@Component({
    selector: 'app-about',
    standalone: true,
    imports: [RouterLink, ExternalUrlPipe],
    templateUrl: './about.component.html',
})
export class AboutComponent implements OnInit {
    private readonly seo = inject(SeoService);
    readonly footerSettings = inject(FooterSettingsService);

    readonly techStack = TECH_STACK;

    ngOnInit(): void {
        this.seo.update({
            title: 'About | Mohammad Hamza',
            description: 'About Mohammad Hamza — application developer and product designer based in Karāchi, Pakistan. Background, honors, and the tech stack I work with.',
            url: '/about',
            type: 'profile',
        });
        this.footerSettings.load();
    }

    isSocialVisible(key: string): boolean {
        const vis = this.footerSettings.data().socialVisibility;
        return vis?.[key]?.['contact'] !== false;
    }
}
