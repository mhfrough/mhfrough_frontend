import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { FooterSettingsService } from '../../../core/services/footer-settings.service';

@Component({
    selector: 'app-terms',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './terms.component.html',
})
export class TermsComponent implements OnInit {
    private titleService = inject(Title);
    readonly footerSettings = inject(FooterSettingsService);

    ngOnInit() {
        this.titleService.setTitle('Terms of Service | Mohammad Hamza');
        this.footerSettings.load();
    }

    isSocialVisible(key: string): boolean {
        const vis = this.footerSettings.data().socialVisibility;
        return vis?.[key]?.['contact'] !== false;
    }
}
