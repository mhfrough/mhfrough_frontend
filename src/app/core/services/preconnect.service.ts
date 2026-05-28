import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class PreconnectService {
    private readonly doc = inject(DOCUMENT);
    private readonly added = new Set<string>();

    /** Ensures a `<link rel="preconnect">` exists in <head> for the origin of `url`. */
    add(url: string | null | undefined): void {
        if (!url) return;
        let origin: string;
        try {
            origin = new URL(url).origin;
        } catch {
            return; // relative or invalid URL — no preconnect needed
        }
        if (origin === 'null' || this.added.has(origin)) return;
        this.added.add(origin);

        const head = this.doc.head;
        if (head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;

        const link = this.doc.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        head.appendChild(link);
    }
}
