import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

export interface SeoData {
    title: string;
    description: string;
    /** Absolute or site-relative URL of the page (used for canonical + og:url). */
    url?: string;
    image?: string;
    type?: 'website' | 'article' | 'profile';
    keywords?: string;
}

const SITE_URL = 'https://mhfrough.dev';
const DEFAULT_IMAGE = `${SITE_URL}/assets/og-image.png`;

/** Sets per-route title, meta description, Open Graph/Twitter tags, canonical link and JSON-LD. */
@Injectable({ providedIn: 'root' })
export class SeoService {
    private readonly title = inject(Title);
    private readonly meta = inject(Meta);
    private readonly document = inject(DOCUMENT);

    update(data: SeoData): void {
        const url = data.url ? this.toAbsoluteUrl(data.url) : this.document.location?.href ?? SITE_URL;
        const image = data.image ?? DEFAULT_IMAGE;
        const type = data.type ?? 'website';

        this.title.setTitle(data.title);

        this.setTag('name', 'description', data.description);
        if (data.keywords) this.setTag('name', 'keywords', data.keywords);

        this.setTag('property', 'og:title', data.title);
        this.setTag('property', 'og:description', data.description);
        this.setTag('property', 'og:type', type);
        this.setTag('property', 'og:url', url);
        this.setTag('property', 'og:image', image);

        this.setTag('name', 'twitter:card', 'summary_large_image');
        this.setTag('name', 'twitter:title', data.title);
        this.setTag('name', 'twitter:description', data.description);
        this.setTag('name', 'twitter:image', image);

        this.setCanonical(url);
    }

    /** Injects/replaces a JSON-LD <script> block scoped to the current route. */
    setJsonLd(json: object): void {
        this.removeJsonLd();
        const script = this.document.createElement('script');
        script.id = 'route-jsonld';
        script.type = 'application/ld+json';
        script.text = JSON.stringify(json);
        this.document.head.appendChild(script);
    }

    removeJsonLd(): void {
        this.document.getElementById('route-jsonld')?.remove();
    }

    private setTag(attr: 'name' | 'property', key: string, content: string): void {
        this.meta.updateTag({ [attr]: key, content });
    }

    private setCanonical(url: string): void {
        let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!link) {
            link = this.document.createElement('link');
            link.setAttribute('rel', 'canonical');
            this.document.head.appendChild(link);
        }
        link.setAttribute('href', url);
    }

    private toAbsoluteUrl(path: string): string {
        if (/^https?:\/\//i.test(path)) return path;
        return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
    }
}
