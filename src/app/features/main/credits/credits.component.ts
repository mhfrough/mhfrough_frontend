import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

@Component({
    selector: 'app-credits',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './credits.component.html',
})
export class CreditsComponent implements OnInit {
    private readonly seo = inject(SeoService);

    ngOnInit(): void {
        this.seo.update({
            title: 'Credits | Mohammad Hamza',
            description: 'The technologies, tools, libraries, and services that power mhfrough.dev.',
            url: '/credits',
        });
    }
}
