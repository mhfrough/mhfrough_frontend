import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FooterSettingsService } from '../../../core/services/footer-settings.service';
import { SeoService } from '../../../core/services/seo.service';

@Component({
    selector: 'app-terms',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './terms.component.html',
})
export class TermsComponent implements OnInit {
    private seo = inject(SeoService);
    readonly footerSettings = inject(FooterSettingsService);

    ngOnInit() {
        this.seo.update({
            title: 'Terms of Service | Mohammad Hamza',
            description: 'Terms of service for mhfrough.dev — the conditions that apply when using this website and its services.',
            url: '/terms',
        });
        this.footerSettings.load();
    }

    isSocialVisible(key: string): boolean {
        const vis = this.footerSettings.data().socialVisibility;
        return vis?.[key]?.['contact'] !== false;
    }
}
