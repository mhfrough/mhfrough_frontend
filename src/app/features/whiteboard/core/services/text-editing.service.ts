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

        // A collapsed caret has no span to overlap-test against — resolve it to the single
        // line it sits in directly, rather than testing every line's range against a point
        // (which can double-match right at a line boundary, e.g. right after pressing Enter).
        let targets: { first: Node; last: Node }[];
        if (original.collapsed) {
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
