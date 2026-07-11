import { Directive, ElementRef, NgZone, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface GlyphCell {
    x: number;
    y: number;
    glyph: string;
    alpha: number;   // resting opacity
    amp: number;     // twinkle amplitude (0 = static cell)
    speed: number;   // twinkle speed, rad/s
    phase: number;   // twinkle phase offset
}

// Inconsolata has no Arabic glyphs — ء falls through to a system font. It is
// drawn larger than the dots/plus marks: at their size its loop closes up and
// it reads as just another dot.
const BASE_FONT = '500 11px Inconsolata, "Courier New", monospace';
const HAMZA_FONT = '500 17px Inconsolata, "Courier New", monospace';

/**
 * Generative glyph field for the hero — a faint 26px grid of `·`, `+` and the
 * hamza (ء) brand mark:
 *
 *   ·  +  ·  ء  ·  +
 *   +  ·  ·  +  ·  ·
 *
 * Cells sit on an exact grid; each gets a seeded-random glyph (mostly dots,
 * some plus marks, a scattering of hamzas) and opacity. A small subset of
 * glyphs twinkle very slowly. The seed is fixed, so the layout is identical
 * on every visit and stable across resizes.
 *
 * Usage:
 *   <canvas appGlyphField aria-hidden="true"></canvas>
 *
 * Guardrails: SSR-safe (no-op on the server — purely decorative), draws
 * nothing on coarse-pointer/mobile devices, renders a static field under
 * `prefers-reduced-motion`, animates at ~30fps and only while the canvas is
 * actually in the viewport.
 */
@Directive({
    selector: 'canvas[appGlyphField]',
    standalone: true,
})
export class GlyphFieldDirective implements OnInit, OnDestroy {
    private el = inject<ElementRef<HTMLCanvasElement>>(ElementRef);
    private zone = inject(NgZone);
    private platformId = inject(PLATFORM_ID);

    private ctx: CanvasRenderingContext2D | null = null;
    private cells: GlyphCell[] = [];
    private color = '';
    private rafId = 0;
    private lastFrame = 0;
    private running = false;
    private animate = false;
    private resizeObs?: ResizeObserver;
    private viewObs?: IntersectionObserver;

    ngOnInit(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        // Desktop / fine-pointer only — on phones the hero is small and busy,
        // and the field would just cost battery.
        if (!window.matchMedia?.('(pointer: fine)').matches) return;

        const canvas = this.el.nativeElement;
        this.ctx = canvas.getContext('2d');
        if (!this.ctx) return;

        this.animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        this.resizeObs = new ResizeObserver(() => this.rebuild());
        this.resizeObs.observe(canvas);

        // Only burn frames while the hero is actually on screen.
        this.viewObs = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) this.start();
            else this.stop();
        });
        this.viewObs.observe(canvas);
    }

    ngOnDestroy(): void {
        this.stop();
        this.resizeObs?.disconnect();
        this.viewObs?.disconnect();
    }

    /** Offset that puts the glyph's visual (bounding-box) centre on the given y. */
    private static centerOffset(ctx: CanvasRenderingContext2D, glyph: string): number {
        const m = ctx.measureText(glyph);
        return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    }

    /** Deterministic PRNG (mulberry32) — fixed seed keeps the field stable. */
    private static rng(seed: number): () => number {
        return () => {
            seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    private rebuild(): void {
        const canvas = this.el.nativeElement;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!w || !h || !this.ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.color = getComputedStyle(canvas).color;

        const cell = 26;
        const cols = Math.ceil(w / cell) + 1;
        const rows = Math.ceil(h / cell) + 1;
        const rand = GlyphFieldDirective.rng(0x68617a); // "haz"

        // Fonts differ per glyph, so each one's measured bounding-box centre
        // is baked into its y — otherwise the ء sits visibly below the row of
        // dots and plus marks it shares.
        this.ctx.textBaseline = 'middle';
        this.ctx.font = BASE_FONT;
        const yOff: Record<string, number> = {
            '·': GlyphFieldDirective.centerOffset(this.ctx, '·'),
            '+': GlyphFieldDirective.centerOffset(this.ctx, '+'),
        };
        this.ctx.font = HAMZA_FONT;
        yOff['ء'] = GlyphFieldDirective.centerOffset(this.ctx, 'ء');

        this.cells = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const roll = rand();
                const glyph = roll < 0.72 ? '·' : roll < 0.89 ? '+' : 'ء';
                const twinkler = this.animate && rand() < 0.15;
                this.cells.push({
                    x: c * cell + cell / 2,
                    y: r * cell + cell / 2 + yOff[glyph],
                    glyph,
                    // The hamza is the brand mark — a notch brighter so it reads.
                    alpha: glyph === 'ء' ? 0.14 + rand() * 0.14 : 0.08 + rand() * 0.14,
                    amp: twinkler ? 0.05 + rand() * 0.06 : 0,
                    speed: 0.4 + rand() * 0.6,
                    phase: rand() * Math.PI * 2,
                });
            }
        }
        this.draw(performance.now());
    }

    private draw(now: number): void {
        const ctx = this.ctx;
        if (!ctx) return;
        const canvas = this.el.nativeElement;
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.color;

        const t = now / 1000;
        ctx.font = BASE_FONT;
        this.pass(ctx, t, false);
        ctx.font = HAMZA_FONT;
        this.pass(ctx, t, true);
        ctx.globalAlpha = 1;
    }

    private pass(ctx: CanvasRenderingContext2D, t: number, hamza: boolean): void {
        for (const cell of this.cells) {
            if ((cell.glyph === 'ء') !== hamza) continue;
            ctx.globalAlpha = cell.amp
                ? cell.alpha + cell.amp * (0.5 + 0.5 * Math.sin(t * cell.speed + cell.phase))
                : cell.alpha;
            ctx.fillText(cell.glyph, cell.x, cell.y);
        }
    }

    private start(): void {
        if (this.running || !this.ctx) return;
        this.running = true;
        if (!this.animate) return; // static field was drawn at rebuild()

        this.zone.runOutsideAngular(() => {
            const tick = (t: number) => {
                if (!this.running) return;
                // The twinkle is slow — ~30fps is indistinguishable at 60.
                if (t - this.lastFrame >= 32) {
                    this.lastFrame = t;
                    this.draw(t);
                }
                this.rafId = requestAnimationFrame(tick);
            };
            this.rafId = requestAnimationFrame(tick);
        });
    }

    private stop(): void {
        this.running = false;
        cancelAnimationFrame(this.rafId);
    }
}
