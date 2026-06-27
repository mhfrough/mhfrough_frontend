import { Directive, ElementRef, Input, OnInit, OnDestroy, PLATFORM_ID, inject, numberAttribute } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Counts a number up from 0 to a target the first time the element scrolls into
 * view — e.g. `100` animates 0 → 100. Mirrors the home-page stats animation
 * (cubic ease-out) so every counter on the site behaves identically.
 *
 * Usage:
 *   <span [appCountUp]="100" suffix="%">0</span>
 *   <span [appCountUp]="30" suffix="+" [startDelay]="120">0</span>
 *
 * SSR-safe (renders the final value on the server / no-JS) and respects
 * `prefers-reduced-motion` (no animation, shows the final value instantly).
 */
@Directive({
    selector: '[appCountUp]',
    standalone: true,
})
export class CountUpDirective implements OnInit, OnDestroy {
    private el = inject<ElementRef<HTMLElement>>(ElementRef);
    private platformId = inject(PLATFORM_ID);

    /** Final value to count up to. */
    @Input({ alias: 'appCountUp', transform: numberAttribute }) target = 0;
    /** Text rendered before the number, e.g. '$'. */
    @Input() prefix = '';
    /** Text rendered after the number, e.g. '+', '%'. */
    @Input() suffix = '';
    /** Animation length in ms. */
    @Input({ transform: numberAttribute }) duration = 300;
    /** Delay before counting starts once visible, in ms — handy for staggering. */
    @Input({ transform: numberAttribute }) startDelay = 0;
    /** Decimal places to render (0 → whole numbers). */
    @Input({ transform: numberAttribute }) decimals = 0;

    private observer?: IntersectionObserver;
    private rafId = 0;
    private timerId = 0;
    private started = false;

    ngOnInit(): void {
        const node = this.el.nativeElement;

        // Server, no-JS, and reduced-motion users always see the real number.
        if (!isPlatformBrowser(this.platformId) ||
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            node.textContent = this.format(this.target);
            return;
        }

        node.textContent = this.format(0);
        this.observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !this.started) {
                this.started = true;
                this.observer?.disconnect();
                this.timerId = window.setTimeout(() => this.run(), this.startDelay);
            }
        }, { threshold: 0.4 });
        this.observer.observe(node);
    }

    ngOnDestroy(): void {
        this.observer?.disconnect();
        cancelAnimationFrame(this.rafId);
        clearTimeout(this.timerId);
    }

    private run(): void {
        const node = this.el.nativeElement;
        const start = performance.now();
        const tick = () => {
            const elapsed = performance.now() - start;
            if (elapsed >= this.duration) {
                node.textContent = this.format(this.target);
                return;
            }
            const eased = 1 - Math.pow(1 - elapsed / this.duration, 3);
            node.textContent = this.format(eased * this.target);
            this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
    }

    private format(value: number): string {
        const num = this.decimals > 0 ? value.toFixed(this.decimals) : Math.round(value).toString();
        return `${this.prefix}${num}${this.suffix}`;
    }
}
