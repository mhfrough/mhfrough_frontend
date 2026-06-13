import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { SERVICES, PROCESS_STEPS, PRICING_TIERS } from '../../../core/data/site-content';

@Component({
    selector: 'app-services',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './services.component.html',
})
export class ServicesComponent implements OnInit {
    private readonly seo = inject(SeoService);

    // Same canonical content the home page renders — one source of truth.
    readonly services = SERVICES;
    readonly processSteps = PROCESS_STEPS;
    readonly pricingTiers = PRICING_TIERS;

    readonly openFaqItems = signal<number[]>([]);

    ngOnInit(): void {
        this.seo.update({
            title: 'Services & Pricing | Mohammad Hamza',
            description: 'Full-stack web development services — Angular + NestJS apps, APIs, frontend engineering, UI/UX, and ongoing support. See what I do, how I work, and indicative pricing.',
            url: '/services',
        });
    }
}
