import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ToolService } from '../../core/services/tool.service';
import { SelectionService } from '../../core/services/selection.service';
import { ColorFieldComponent } from '../../ui/color-field.component';
import { DashStyle, ElementStyle } from '../../core/models/style.model';
import { FILL_PALETTE, FONT_FAMILIES, STROKE_PALETTE, THEME_FONT } from '../../core/models/palette.model';
import { StickyElement, TextElement, WhiteboardElement, isTextLike } from '../../core/models/element.model';

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
    readonly fonts = FONT_FAMILIES;
    readonly themeFont = THEME_FONT;
    readonly dashOptions = DASH_OPTIONS;
    readonly strokeWidths = STROKE_WIDTHS;

    constructor(private readonly tools: ToolService, private readonly selection: SelectionService) {}

    /** Show when a tool that produces styleable output is active, or a selection exists. */
    readonly visible = computed(() => this.selection.hasSelection() || this.tools.activeTool() !== 'selection');

    /** The style currently being edited: first selected element, else the tool default. */
    readonly style = computed<ElementStyle>(() => {
        const sel = this.selection.selectedElements();
        return sel.length ? sel[0].style : this.tools.style();
    });

    readonly textEl = computed<TextElement | StickyElement | null>(() => {
        const sel = this.selection.selectedElements();
        const first = sel.find(isTextLike);
        return first ?? null;
    });

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

    setFont(event: Event): void {
        this.applyText({ fontFamily: (event.target as HTMLSelectElement).value });
        this.commit();
    }

    setFontSize(event: Event): void {
        const size = Number((event.target as HTMLInputElement).value);
        this.applyText({ fontSize: size } as Partial<TextElement>);
    }

    toggleBold(): void {
        const el = this.textEl();
        if (el?.type === 'text') this.applyText({ fontWeight: el.fontWeight === 700 ? 400 : 700 });
        this.commit();
    }

    toggleItalic(): void {
        const el = this.textEl();
        if (el?.type === 'text') this.applyText({ italic: !el.italic });
        this.commit();
    }

    toggleUnderline(): void {
        const el = this.textEl();
        if (el?.type === 'text') this.applyText({ underline: !el.underline });
        this.commit();
    }

    setAlign(align: 'left' | 'center' | 'right'): void {
        this.applyText({ textAlign: align });
        this.commit();
    }

    setTextColor(color: string): void {
        this.applyText({ color } as Partial<TextElement>);
        this.commit();
    }

    asText(el: WhiteboardElement | null): TextElement | null {
        return el?.type === 'text' ? el : null;
    }

    opacityPercent(): number {
        return Math.round(this.style().opacity * 100);
    }
}
