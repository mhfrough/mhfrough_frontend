import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { ExternalUrlPipe } from '../../../shared/pipes/external-url.pipe';
import { SERVICES, PROCESS_STEPS, PRICING_TIERS } from '../../../core/data/site-content';

@Component({
    selector: 'app-services',
    standalone: true,
    imports: [RouterLink, ExternalUrlPipe],
    templateUrl: './services.component.html',
})
export class ServicesComponent implements OnInit {
    private readonly seo = inject(SeoService);

    // Same canonical content the home page renders — one source of truth.
    readonly services = SERVICES;
    readonly processSteps = PROCESS_STEPS;
    readonly pricingTiers = PRICING_TIERS;

    readonly clients = [
        { name: 'Arittek Solutions (Pvt.) Ltd.', logo: '/clients/arittek.png', url: 'https://arittek.com/' },
        { name: 'Befiler', logo: '/clients/befiler.png', url: 'https://www.befiler.com/' },
        { name: 'Bloomstone Private Resort', logo: '/clients/bloomstone.png', url: 'https://bloomstone.pk/' },
        { name: 'Finclore', logo: '/clients/finclore.png', url: 'https://www.finclore.com/' },
    ];
    readonly marqueeClients = [...this.clients, ...this.clients];

    readonly openFaqItems = signal<number[]>([]);

    ngOnInit(): void {
        this.seo.update({
            title: 'Services & Pricing | Mohammad Hamza',
            description: 'Full-stack web development services — Angular + NestJS apps, APIs, frontend engineering, UI/UX, and ongoing support. See what I do, how I work, and indicative pricing.',
            url: '/services',
        });
    }
}
