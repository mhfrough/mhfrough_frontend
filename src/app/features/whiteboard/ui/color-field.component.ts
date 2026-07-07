import {
    ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, computed, inject, signal,
} from '@angular/core';
import { RecentColorsService } from '../core/services/recent-colors.service';
import { Hsv, Rgba, hsvToRgb, parseColor, rgbToHex, rgbToHsv, toColorString } from '../core/utils/color.util';

type Drag = 'sv' | 'hue' | 'alpha';

/**
 * XD/Figma-style color field: a compact trigger with a one-line recent-colors row,
 * opening a popover with a saturation/value area, hue + alpha sliders and HEX / RGBA inputs.
 */
@Component({
    selector: 'app-color-field',
    standalone: true,
    imports: [],
    templateUrl: './color-field.component.html',
    styleUrl: './color-field.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorFieldComponent {
    private readonly recentSvc = inject(RecentColorsService);
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

    @Input({ required: true }) swatches: readonly string[] = [];
    @Input() allowTransparent = false;

    private _value = '#000000';
    @Input() set value(v: string | null) {
        this._value = v || '#000000';
        if (!this.editing) this.syncFromValue(this._value);
    }
    get value(): string { return this._value; }

    @Output() readonly colorChange = new EventEmitter<string>();

    readonly open = signal(false);
    readonly popPos = signal<{ top: number; left: number }>({ top: 0, left: 0 });
    readonly hsv = signal<Hsv>({ h: 0, s: 0, v: 0 });
    readonly alpha = signal(1);
    readonly isNone = signal(false);
    readonly recent = this.recentSvc.colors;

    /** True while dragging / typing so an incoming @Input value doesn't clobber in-progress edits. */
    private editing = false;
    private drag: Drag | null = null;

    readonly rgb = computed(() => { const { h, s, v } = this.hsv(); return hsvToRgb(h, s, v); });
    readonly currentCss = computed(() => this.isNone() ? 'transparent' : toColorString({ ...this.rgb(), a: this.alpha() }));
    readonly previewCss = computed(() => this.isNone() ? 'transparent' : `rgba(${this.rgb().r}, ${this.rgb().g}, ${this.rgb().b}, ${this.alpha()})`);
    readonly rgbCss = computed(() => `rgb(${this.rgb().r}, ${this.rgb().g}, ${this.rgb().b})`);
    readonly hueCss = computed(() => `hsl(${Math.round(this.hsv().h)}, 100%, 50%)`);
    readonly hexValue = computed(() => rgbToHex(this.rgb().r, this.rgb().g, this.rgb().b).slice(1).toUpperCase());
    readonly alphaPercent = computed(() => Math.round(this.alpha() * 100));
    readonly svThumb = computed(() => ({ left: this.hsv().s * 100, top: (1 - this.hsv().v) * 100 }));
    readonly svBg = computed(() => `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${this.hueCss()})`);
    readonly alphaBg = computed(() => `linear-gradient(to right, transparent, ${this.rgbCss()})`);

    /** Background for a plain swatch chip (opaque colors); transparent handled by a CSS class. */
    swatchBg(c: string): string | null {
        return c === 'transparent' ? null : c;
    }

    toggle(e: MouseEvent): void {
        if (this.open()) { this.close(); return; }
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const w = 236, h = 320;
        let left = r.left;
        let top = r.bottom + 6;
        if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
        if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
        this.popPos.set({ top, left: Math.max(8, left) });
        this.syncFromValue(this._value);
        this.open.set(true);
    }

    close(): void {
        if (!this.open()) return;
        this.open.set(false);
        this.editing = false;
        this.drag = null;
        this.recentSvc.add(this.currentCss());
    }

    @HostListener('document:pointerdown', ['$event'])
    onDocPointerDown(e: PointerEvent): void {
        if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close();
    }

    @HostListener('document:keydown.escape')
    onEsc(): void { this.close(); }

    /** Pick a preset / recent / transparent swatch. */
    applyColor(c: string): void {
        this.syncFromValue(c);
        this.colorChange.emit(this.currentCss());
        this.recentSvc.add(c);
    }

    // --- slider drags ----------------------------------------------------------
    pointerDown(e: PointerEvent, kind: Drag): void {
        e.preventDefault();
        this.editing = true;
        this.drag = kind;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        this.updateFromPointer(e, kind);
    }

    pointerMove(e: PointerEvent): void {
        if (this.drag) this.updateFromPointer(e, this.drag);
    }

    pointerUp(e: PointerEvent): void {
        this.drag = null;
        this.editing = false;
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* not captured */ }
        this.recentSvc.add(this.currentCss());
    }

    private updateFromPointer(e: PointerEvent, kind: Drag): void {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const fx = clamp01((e.clientX - rect.left) / rect.width);
        const fy = clamp01((e.clientY - rect.top) / rect.height);
        this.isNone.set(false);
        if (kind === 'sv') this.hsv.update(c => ({ ...c, s: fx, v: 1 - fy }));
        else if (kind === 'hue') this.hsv.update(c => ({ ...c, h: fx * 360 }));
        else this.alpha.set(fx);
        this.colorChange.emit(this.currentCss());
    }

    // --- text inputs -----------------------------------------------------------
    onHex(e: Event): void {
        const raw = (e.target as HTMLInputElement).value.trim();
        const c = parseColor(raw.startsWith('#') ? raw : '#' + raw);
        this.setRgb(c);
    }

    onRgbInput(channel: 'r' | 'g' | 'b', e: Event): void {
        const val = Math.max(0, Math.min(255, Math.round(Number((e.target as HTMLInputElement).value) || 0)));
        this.setRgb({ ...this.rgb(), [channel]: val, a: this.alpha() } as Rgba);
    }

    onAlphaInput(e: Event): void {
        const pct = Math.max(0, Math.min(100, Math.round(Number((e.target as HTMLInputElement).value) || 0)));
        this.isNone.set(false);
        this.alpha.set(pct / 100);
        this.colorChange.emit(this.currentCss());
        this.recentSvc.add(this.currentCss());
    }

    private setRgb(c: Rgba): void {
        const hsv = rgbToHsv(c.r, c.g, c.b);
        this.isNone.set(false);
        this.hsv.set({ h: hsv.s === 0 ? this.hsv().h : hsv.h, s: hsv.s, v: hsv.v });
        this.colorChange.emit(this.currentCss());
        this.recentSvc.add(this.currentCss());
    }

    private syncFromValue(v: string): void {
        this.isNone.set(v === 'transparent');
        const c = parseColor(v);
        this.alpha.set(c.a);
        const hsv = rgbToHsv(c.r, c.g, c.b);
        // Preserve hue for greyscale so the SV thumb doesn't snap to red.
        this.hsv.set({ h: hsv.s === 0 ? this.hsv().h : hsv.h, s: hsv.s, v: hsv.v });
    }
}

function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}
