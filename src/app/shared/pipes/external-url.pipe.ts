import { Pipe, PipeTransform } from '@angular/core';

/**
 * Appends UTM / analytics query parameters to any external (http/https) URL.
 * Non-http URLs (mailto:, tel:, relative paths) are returned unchanged.
 *
 * Usage:  [href]="url | externalUrl:'content_label'"
 */
@Pipe({ name: 'externalUrl', standalone: true, pure: true })
export class ExternalUrlPipe implements PipeTransform {
    transform(url: string | null | undefined, content?: string): string {
        if (!url) return '';
        if (!url.startsWith('http://') && !url.startsWith('https://')) return url;

        const params = new URLSearchParams();
        params.set('utm_source', 'mhfrough.dev');
        params.set('utm_medium', 'portfolio');
        params.set('utm_campaign', 'outbound');
        if (content) params.set('utm_content', content);

        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}${params.toString()}`;
    }
}
