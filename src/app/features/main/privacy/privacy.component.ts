import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FooterSettingsService } from '../../../core/services/footer-settings.service';
import { SeoService } from '../../../core/services/seo.service';

@Component({
    selector: 'app-privacy',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './privacy.component.html',
})
export class PrivacyComponent implements OnInit {
    private seo = inject(SeoService);
    readonly footerSettings = inject(FooterSettingsService);

    ngOnInit() {
        this.seo.update({
            title: 'Privacy Policy | Mohammad Hamza',
            description: 'Privacy policy for mhfrough.dev — how visitor data is collected, used, and protected.',
            url: '/privacy',
        });
        this.footerSettings.load();
    }

    isSocialVisible(key: string): boolean {
        const vis = this.footerSettings.data().socialVisibility;
        return vis?.[key]?.['contact'] !== false;
    }
}
