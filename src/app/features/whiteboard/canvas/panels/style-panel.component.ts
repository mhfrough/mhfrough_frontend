import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ToolService } from '../../core/services/tool.service';
import { SelectionService } from '../../core/services/selection.service';
import { ImageOpsService } from '../../core/services/image-ops.service';
import { CaseTransform, TextEditingService } from '../../core/services/text-editing.service';
import { ColorFieldComponent } from '../../ui/color-field.component';
import { DashStyle, ElementStyle } from '../../core/models/style.model';
import { FILL_PALETTE, FONT_FAMILIES, FONT_WEIGHTS, STICKY_PALETTE, STROKE_PALETTE, THEME_FONT } from '../../core/models/palette.model';
import { ImageElement, StickyElement, TextElement, WhiteboardElement, isImageElement, isTextLike } from '../../core/models/element.model';
import { CombineOp } from '../../core/utils/image-ops.util';

const CROP_RATIOS: { label: string; value: number }[] = [
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:2', value: 3 / 2 },
    { label: '16:9', value: 16 / 9 },
    { label: '7:4', value: 7 / 4 },
    { label: '3:4', value: 3 / 4 },
    { label: '9:16', value: 9 / 16 },
];

const COMBINE_OPS: { id: CombineOp; label: string; icon: string }[] = [
    { id: 'union', label: 'Union', icon: 'bi-union' },
    { id: 'subtract', label: 'Subtract', icon: 'bi-subtract' },
    { id: 'intersect', label: 'Intersect', icon: 'bi-intersect' },
    { id: 'exclude', label: 'Exclude', icon: 'bi-exclude' },
    { id: 'mask', label: 'Mask', icon: 'bi-mask' },
];

const DASH_OPTIONS: { id: DashStyle; icon: string }[] = [
    { id: 'solid', icon: 'bi-dash-lg' },
    { id: 'dashed', icon: 'bi-three-dots' },
    { id: 'dotted', icon: 'bi-three-dots-vertical' },
];

const STROKE_WIDTHS = [1, 2, 4, 8];

/**
 * Contextual style panel. Edits the current selection when something is selected,
 * otherwise edits the tool's default style applied to the next drawn element.
 */
@Component({
    selector: 'app-style-panel',
    standalone: true,
    imports: [ColorFieldComponent],
    templateUrl: './style-panel.component.html',
    styleUrl: './style-panel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StylePanelComponent {
    readonly strokePalette = STROKE_PALETTE;
    readonly fillPalette = FILL_PALETTE;
    readonly stickyPalette = STICKY_PALETTE;
    readonly fonts = FONT_FAMILIES;
    readonly fontWeights = FONT_WEIGHTS;
    readonly themeFont = THEME_FONT;
    readonly dashOptions = DASH_OPTIONS;
    readonly strokeWidths = STROKE_WIDTHS;
    readonly cropRatios = CROP_RATIOS;
    readonly combineOps = COMBINE_OPS;

    constructor(
        private readonly tools: ToolService,
        private readonly selection: SelectionService,
        readonly imageOps: ImageOpsService,
        readonly textEditing: TextEditingService,
    ) {}

    /** Show when a tool that produces styleable output is active, or a selection exists. */
    readonly visible = computed(() => this.selection.hasSelection() || this.tools.activeTool() !== 'selection');

    /** The style currently being edited: first selected element, else the tool default. */
    readonly style = computed<ElementStyle>(() => {
        const sel = this.selection.selectedElements();
        return sel.length ? sel[0].style : this.tools.style();
    });

    /** The single selected element, for the position/size inspector. */
    readonly single = computed<WhiteboardElement | null>(() => {
        const sel = this.selection.selectedElements();
        return sel.length === 1 ? sel[0] : null;
    });

    readonly textEl = computed<TextElement | StickyElement | null>(() => {
        const sel = this.selection.selectedElements();
        const first = sel.find(isTextLike);
        return first ?? null;
    });

    /** A text or sticky element is selected — swap the shape controls for typography controls. */
    readonly isTextSelected = computed(() => this.textEl() !== null);

    /** Formatting (bold/italic/.../checklist) needs an active caret — only meaningful while editing. */
    readonly isActivelyEditingSelected = computed(() => {
        const el = this.textEl();
        return el !== null && this.textEditing.editingId() === el.id;
    });

    readonly stickyEl = computed<StickyElement | null>(() => {
        const sel = this.selection.selectedElements();
        const first = sel.find((el): el is StickyElement => el.type === 'sticky');
        return first ?? null;
    });

    /** Exactly one image is selected (possibly alongside a mask shape). */
    readonly imageEl = computed<ImageElement | null>(() => {
        const images = this.selection.selectedElements().filter(isImageElement);
        return images.length === 1 ? images[0] : null;
    });

    readonly isImageSelected = computed(() => this.selection.selectedElements().some(isImageElement));

    /** Exactly two objects of any type → eligible for union / subtract / intersect / exclude / mask. */
    readonly canCombine = computed(() => this.selection.selectedElements().length === 2);

    readonly isRectLike = computed(() => {
        const sel = this.selection.selectedElements();
        if (sel.length) return sel.some(el => el.type === 'rectangle');
        return this.tools.activeTool() === 'rectangle' || this.tools.activeTool() === 'rounded-rectangle';
    });

    private apply(patch: Partial<ElementStyle>): void {
        if (this.selection.hasSelection()) this.selection.updateStyle(patch);
        else this.tools.updateStyle(patch);
    }

    /** Record one history entry for a settled edit (call after discrete change / slider release). */
    commit(): void {
        if (this.selection.hasSelection()) this.selection.commitHistory();
    }

    setStroke(color: string): void {
        this.apply({ strokeColor: color });
        this.commit();
    }

    setFill(color: string): void {
        this.apply({ fillColor: color });
        this.commit();
    }

    setStrokeWidth(width: number): void {
        this.apply({ strokeWidth: width });
        this.commit();
    }

    setDash(dash: DashStyle): void {
        this.apply({ dash });
        this.commit();
    }

    setOpacity(event: Event): void {
        this.apply({ opacity: Number((event.target as HTMLInputElement).value) / 100 });
    }

    setCornerRadius(event: Event): void {
        this.apply({ cornerRadius: Number((event.target as HTMLInputElement).value) });
    }

    // --- text-specific -----------------------------------------------------
    private applyText(patch: Partial<TextElement>): void {
        this.selection.updateTextProps(patch);
    }

    // Font/Weight/Size/Text-color all prefer acting on the current text *selection* (like Bold
    // already does) when there is one — only falling back to the whole box when there's
    // nothing selected to target, e.g. setting the box's default before you've typed anything.
    setFont(event: Event): void {
        const family = (event.target as HTMLSelectElement).value;
        if (this.textEditing.hasTextSelection()) {
            this.textEditing.setFontFamily(family);
            return;
        }
        this.applyText({ fontFamily: family });
        this.commit();
    }

    setFontSize(event: Event): void {
        const size = Number((event.target as HTMLInputElement).value);
        // Unlike the range slider (always a valid clamped number), the number input can be
        // blurred empty or mid-edit — ignore rather than writing NaN into the element.
        if (Number.isNaN(size)) return;
        if (this.textEditing.hasTextSelection()) {
            this.textEditing.setFontSize(size);
            return;
        }
        this.applyText({ fontSize: size } as Partial<TextElement>);
    }

    setFontWeight(event: Event): void {
        const weight = Number((event.target as HTMLSelectElement).value);
        if (this.textEditing.hasTextSelection()) {
            this.textEditing.setFontWeight(weight);
            return;
        }
        this.applyText({ fontWeight: weight } as Partial<TextElement>);
        this.commit();
    }

    // Real per-selection formatting acts on the browser's own selection inside the
    // currently-editing contenteditable (see TextEditingService) — not the whole element.
    toggleBold(): void {
        this.textEditing.format('bold');
    }

    toggleItalic(): void {
        this.textEditing.format('italic');
    }

    toggleUnderline(): void {
        this.textEditing.format('underline');
    }

    toggleStrike(): void {
        this.textEditing.format('strikeThrough');
    }

    toggleSuperscript(): void {
        this.textEditing.format('superscript');
    }

    toggleSubscript(): void {
        this.textEditing.format('subscript');
    }

    applyCase(mode: CaseTransform): void {
        this.textEditing.transformCase(mode);
    }

    insertChecklist(): void {
        this.textEditing.toggleChecklistLine();
    }

    setAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
        this.applyText({ textAlign: align });
        this.commit();
    }

    setSizing(sizing: 'auto' | 'fixed'): void {
        this.applyText({ sizing } as Partial<TextElement>);
        this.commit();
    }

    setTextColor(color: string): void {
        if (this.textEditing.hasTextSelection()) {
            this.textEditing.setColor(color);
            return;
        }
        this.applyText({ color } as Partial<TextElement>);
        this.commit();
    }

    setStickyFill(color: string): void {
        this.selection.updateStickyProps({ fill: color });
        this.commit();
    }

    // --- geometry inspector (X / Y / W / H / angle) ------------------------
    setGeometry(field: 'x' | 'y' | 'width' | 'height' | 'rotation' | 'rotationX' | 'rotationY', event: Event): void {
        const raw = Number((event.target as HTMLInputElement).value);
        if (Number.isNaN(raw)) return;
        this.selection.setElementGeometry({ [field]: Math.round(raw) });
    }

    round(v: number): number {
        return Math.round(v);
    }

    roundOr0(v: number | undefined): number {
        return Math.round(v ?? 0);
    }

    // --- image-specific ----------------------------------------------------
    cropTo(ratio: number): void {
        const el = this.imageEl();
        if (el) void this.imageOps.autoCrop(el, ratio);
    }

    startCrop(): void {
        const el = this.imageEl();
        if (el) this.imageOps.startCrop(el);
    }

    resetImage(): void {
        const el = this.imageEl();
        if (el) void this.imageOps.resetImage(el);
    }

    combine(op: CombineOp): void {
        if (this.canCombine()) void this.imageOps.combineSelected(op);
    }

    asText(el: WhiteboardElement | null): TextElement | null {
        return el?.type === 'text' ? el : null;
    }

    opacityPercent(): number {
        return Math.round(this.style().opacity * 100);
    }
}
