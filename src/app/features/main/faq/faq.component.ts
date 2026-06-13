import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { FAQS } from '../../../core/data/site-content';

@Component({
    selector: 'app-faq',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './faq.component.html',
})
export class FaqComponent implements OnInit, OnDestroy {
    private readonly seo = inject(SeoService);

    readonly faqs = FAQS;
    readonly openFaqItems = signal<number[]>([]);

    ngOnInit(): void {
        this.seo.update({
            title: 'FAQ | Mohammad Hamza',
            description: 'Frequently asked questions about working with Mohammad Hamza — clients, timelines, NDAs, revisions, payments, and joining existing teams.',
            url: '/faq',
        });
        this.seo.setJsonLd({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: this.faqs.map(faq => ({
                '@type': 'Question',
                name: faq.q,
                acceptedAnswer: { '@type': 'Answer', text: faq.a },
            })),
        });
    }

    ngOnDestroy(): void {
        this.seo.removeJsonLd();
    }

    toggleFaq(i: number): void {
        const cur = this.openFaqItems();
        this.openFaqItems.set(cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i]);
    }
}
