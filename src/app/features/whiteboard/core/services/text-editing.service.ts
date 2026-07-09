import { Injectable, signal } from '@angular/core';
import { enumerateLines, findLineContainer, firstTextNode, glyphMarkerLength, isChecklistLine, lineTouchedBySelection } from '../utils/checklist.util';

export type FormatCommand = 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'superscript' | 'subscript';

export interface ActiveFormats {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikeThrough: boolean;
    superscript: boolean;
    subscript: boolean;
}

export type CaseTransform = 'upper' | 'lower' | 'title';

const NO_FORMATS: ActiveFormats = {
    bold: false, italic: false, underline: false, strikeThrough: false,
    superscript: false, subscript: false,
};

/**
 * Coordinates rich-text formatting for whichever text/sticky element is currently
 * being edited. `TextLayerComponent` registers the live contenteditable node while
 * editing; `StylePanelComponent` calls `format()` so its Bold/Italic/... buttons act
 * on the browser's own selection inside that node (via document.execCommand — still
 * the simplest reliable way to apply per-selection formatting in a contenteditable).
 */
@Injectable()
export class TextEditingService {
    readonly editingId = signal<string | null>(null);
    /** Which formats apply at the current caret/selection — drives the toolbar's active-button state. */
    readonly activeFormats = signal<ActiveFormats>(NO_FORMATS);
    private activeEl: HTMLElement | null = null;
    private readonly onSelectionChange = () => this.refreshActiveFormats();
    /**
     * A snapshot of the selection taken right before it's about to be stolen. Buttons don't
     * disturb `window.getSelection()` when focused (that's the whole mousedown-preventDefault
     * trick elsewhere in this file) — but a real `<input>` does: focusing it hands the
     * document's "selection" over to the input's own internal text cursor, wiping out
     * whatever was selected in the contenteditable a moment earlier. `<select>` elements don't
     * do this (no internal text cursor to compete for it), so this only *needs* to matter for
     * inputs, but capturing unconditionally on every panel control is simpler than tracking
     * which ones specifically need it.
     */
    private capturedRange: Range | null = null;

    register(id: string, el: HTMLElement): void {
        this.editingId.set(id);
        this.activeEl = el;
        document.addEventListener('selectionchange', this.onSelectionChange);
        this.refreshActiveFormats();
    }

    clear(id: string): void {
        if (this.editingId() === id) {
            this.editingId.set(null);
            this.activeEl = null;
            this.capturedRange = null;
            document.removeEventListener('selectionchange', this.onSelectionChange);
            this.activeFormats.set(NO_FORMATS);
        }
    }

    format(cmd: FormatCommand): void {
        if (!this.activeEl) return;
        this.activeEl.focus();
        document.execCommand(cmd);
        this.refreshActiveFormats();
    }

    /**
     * Called on `mousedown` of a panel control that's about to steal focus (before the browser's
     * native focus-shift default action actually runs — mousedown's default action fires after
     * bubble-phase listeners, same reason `$event.preventDefault()` on mousedown works elsewhere
     * in this file), so there's still something to restore even once that control has focus.
     */
    captureSelection(): void {
        const sel = window.getSelection();
        this.capturedRange = sel && sel.rangeCount > 0 && !sel.isCollapsed
            && this.activeEl && this.activeEl.contains(sel.anchorNode)
            ? sel.getRangeAt(0).cloneRange()
            : null;
    }

    /**
     * True when there's a real (non-collapsed) text selection inside the box currently being
     * edited — the signal the style panel uses to decide whether Color/Font/Size/Weight should
     * apply to just the selected text (like Bold already does) or fall back to the whole box.
     */
    hasTextSelection(): boolean {
        if (this.capturedRange) return true;
        if (!this.activeEl) return false;
        const sel = window.getSelection();
        return !!sel && !sel.isCollapsed && !!sel.anchorNode && this.activeEl.contains(sel.anchorNode);
    }

    /**
     * Re-applies a captured selection (if any) so a format command has something to act on.
     * Guards against a stale capture from a *previous* editing session (e.g. the user switched
     * to editing a different box without ever touching a panel control in between, so nothing
     * re-captured) by checking the range still belongs to the currently-active element.
     */
    private restoreCapturedSelection(): void {
        if (!this.capturedRange || !this.activeEl) return;
        if (!this.activeEl.contains(this.capturedRange.commonAncestorContainer)) {
            this.capturedRange = null;
            return;
        }
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(this.capturedRange);
    }

    /** Per-selection text color — same execCommand mechanism as Bold/Italic/etc. */
    setColor(color: string): void {
        if (!this.activeEl) return;
        this.activeEl.focus();
        this.restoreCapturedSelection();
        document.execCommand('foreColor', false, color);
    }

    /** Per-selection font family — same mechanism, just a different execCommand. */
    setFontFamily(family: string): void {
        if (!this.activeEl) return;
        this.activeEl.focus();
        this.restoreCapturedSelection();
        document.execCommand('fontName', false, family);
    }

    /**
     * Per-selection font size/weight — no native execCommand takes an arbitrary pixel size or
     * numeric weight (execCommand('fontSize') only has the legacy 1-7 scale), so these wrap the
     * selection in a plain styled `<span>` by hand instead.
     */
    setFontSize(px: number): void {
        this.applyInlineStyleToSelection('font-size', `${px}px`);
    }

    setFontWeight(weight: number): void {
        this.applyInlineStyleToSelection('font-weight', `${weight}`);
    }

    private applyInlineStyleToSelection(prop: string, value: string): void {
        if (!this.activeEl) return;
        this.activeEl.focus();
        this.restoreCapturedSelection();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        if (!this.activeEl.contains(range.commonAncestorContainer)) return;

        const span = document.createElement('span');
        span.style.setProperty(prop, value);
        try {
            // Works when the range's start/end both sit inside the same parent element.
            range.surroundContents(span);
        } catch {
            // Range partially straddles another element (e.g. selection starts mid-way through
            // a <b> run) — surroundContents can't handle that in one step; extract then re-wrap.
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        }

        // Restore the selection to cover the freshly-wrapped span, so a second format command
        // (e.g. Bold right after Size) still has something to act on.
        const after = document.createRange();
        after.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(after);
    }

    /**
     * Unlike bold/italic/monospace (persistent formatting), a case transform is a one-shot edit
     * to the selected text's characters — there's no "active" state to toggle back off. Requires
     * an actual (non-collapsed) selection; a bare caret has no text to rewrite.
     */
    transformCase(mode: CaseTransform): void {
        if (!this.activeEl) return;
        this.activeEl.focus();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        const text = sel.toString();
        const transformed = mode === 'upper' ? text.toUpperCase()
            : mode === 'lower' ? text.toLowerCase()
            : text.replace(/\w\S*/g, word => word[0].toUpperCase() + word.slice(1).toLowerCase());
        // execCommand so this stays on the browser's own undo stack, same as every other format command.
        document.execCommand('insertText', false, transformed);
    }

    /**
     * Toggles every line the selection touches into (or out of) a checklist item. A selection
     * spanning several lines marks/unmarks all of them, not just the one the caret started in —
     * mirrors how bullet/numbered-list toggling works in most editors: if the first touched line
     * is already a checklist item, this removes the marker from every touched line that has one;
     * otherwise it adds one to every touched line that doesn't.
     */
    toggleChecklistLine(): void {
        const el = this.activeEl;
        if (!el) return;
        el.focus();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const original = sel.getRangeAt(0).cloneRange();
        // A double-click that lands right at the gap between two line <div>s can produce a
        // real, non-collapsed selection whose visible text is empty (observed: selecting the
        // implicit "\n" boundary between them) — `containsNode` then matches *both* adjacent
        // lines as "touched", so both get a checkbox even though nothing was visibly selected.
        // Treat a selection with no actual text the same as a collapsed caret: resolve to the
        // one line it's positioned in, not "every line this ambiguous range brushes against".
        const isEffectivelyCollapsed = original.collapsed || sel.toString().trim() === '';

        // A collapsed caret has no span to overlap-test against — resolve it to the single
        // line it sits in directly, rather than testing every line's range against a point
        // (which can double-match right at a line boundary, e.g. right after pressing Enter).
        let targets: { first: Node; last: Node }[];
        if (isEffectivelyCollapsed) {
            const container = findLineContainer(original.startContainer, original.startOffset, el);
            targets = [{ first: container, last: container }];
        } else {
            targets = enumerateLines(el).filter(line => lineTouchedBySelection(sel, line));
        }
        if (!targets.length) return;

        const firstStart = firstTextNode(targets[0].first) ?? firstTextNode(targets[0].last);
        const removing = !!firstStart && isChecklistLine(firstStart.data);

        for (const line of targets) {
            const startNode = firstTextNode(line.first) ?? firstTextNode(line.last);
            if (!startNode) continue;
            const already = isChecklistLine(startNode.data);
            if (removing && already) {
                startNode.deleteData(0, glyphMarkerLength(startNode.data));
            } else if (!removing && !already) {
                startNode.insertData(0, '☐ ');
            }
        }
        // Deliberately not touching `sel` afterwards: Range boundaries auto-adjust to
        // CharacterData mutations in the same node, so the browser keeps the existing
        // selection sane on its own. Calling `sel.removeAllRanges()` here previously left
        // the focused contenteditable with zero ranges, which Chrome treats as a blur —
        // silently exiting edit mode and clearing `activeEl`/`editingId`, so every toggle
        // after the first one no-op'd (nothing left to act on).
    }

    /**
     * Re-reads which formats apply at the current caret/selection (only meaningful while editing).
     * Public so the text layer can also call it after native keyboard shortcuts (Ctrl+B etc.) —
     * those change formatting without moving the selection, so `selectionchange` alone misses them.
     */
    refreshActiveFormats(): void {
        if (!this.activeEl || document.activeElement !== this.activeEl) return;
        this.activeFormats.set({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            strikeThrough: document.queryCommandState('strikeThrough'),
            superscript: document.queryCommandState('superscript'),
            subscript: document.queryCommandState('subscript'),
        });
    }
}
