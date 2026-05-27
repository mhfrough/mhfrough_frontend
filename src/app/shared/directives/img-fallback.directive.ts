import { Directive, HostListener, ElementRef, inject } from '@angular/core';

const FALLBACK_SRC = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 75">` +
    `<rect width="100" height="75" fill="#1a1917"/>` +
    `<rect x="38" y="22" width="24" height="17" rx="1.5" fill="#1e1d1b" stroke="#353330" stroke-width="1.5"/>` +
    `<path d="M38.5 38.5 L42 31 L46 35 L50 29 L55 34 L61.5 30 L61.5 38.5Z" fill="#2a2826"/>` +
    `<circle cx="43" cy="27" r="2" fill="#2a2826"/>` +
    `<text x="50" y="51" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="4.5" fill="#3a3835" letter-spacing="1">IMAGE UNAVAILABLE</text>` +
    `</svg>`
)}`;

@Directive({
    selector: 'img',
    standalone: true,
})
export class ImgFallbackDirective {
    private el = inject<ElementRef<HTMLImageElement>>(ElementRef);

    @HostListener('error')
    onError(): void {
        const img = this.el.nativeElement;
        if (!img.classList.contains('img-error')) {
            img.src = FALLBACK_SRC;
            img.classList.add('img-error');
        }
    }
}
