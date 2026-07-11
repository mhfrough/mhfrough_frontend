import { ChangeDetectionStrategy, Component, ElementRef, Input, effect, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StickyElement, TextElement, WhiteboardElement } from '../../core/models/element.model';
import { SceneService } from '../../core/services/scene.service';
import { HistoryService } from '../../core/services/history.service';
import { SelectionService } from '../../core/services/selection.service';
import { DrawingService } from '../../core/services/drawing.service';
import { TextEditingService } from '../../core/services/text-editing.service';
import { AiImproveMode, WhiteboardApiService } from '../../core/services/whiteboard-api.service';
import { findLineContainer, firstTextNode, glyphMarkerLength, isChecklistLine } from '../../core/utils/checklist.util';
import { linkifyPastedUrl, linkifyTokenBeforeCaret, linkifyTrailingUrl } from '../../core/utils/autolink.util';

const MIN_TEXT_HEIGHT = 40;
const MIN_TEXT_WIDTH = 40;

/**
 * Renders text & sticky-note elements as HTML overlays.
 *
 * Selection model (Excalidraw-style): an element is editable only while it is the
 * one being edited. Otherwise its pointer events fall through to the board surface,
 * so a single click selects/drags it and a double-click enters text editing.
 */
@Component({
    selector: 'app-text-layer',
    standalone: true,
    imports: [],
    templateUrl: './text-layer.component.html',
    styleUrl: './text-layer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextLayerComponent {
    @Input({ required: true }) elements: WhiteboardElement[] = [];

    /** Id of the element currently open for text editing (contenteditable + focused). */
    readonly editingId = signal<string | null>(null);

    /**
     * Pointer-down origin, to tell a clean click (enter edit) apart from a drag (move) on pointerup.
     * Compares the element's actual model position rather than raw pointer coordinates — robust to
     * pointer-capture retargeting during a drag, which can make the final client coordinates unreliable.
     */
    private downState: { id: string; x: number; y: number; wasSelected: boolean } | null = null;

    /**
     * Timestamp of the last confirmed checklist-glyph toggle. Two checkboxes are just different
     * text positions inside the *same* contenteditable div, not separate elements — so clicking
     * two of them in quick succession can still satisfy the browser's own native double-click
     * detection (which only cares about timing/proximity, not which element each click "hit")
     * and fire a real `dblclick` on the div. Without this guard that would open edit mode right
     * after the second checkbox was toggled.
     */
    private lastGlyphToggleAt = 0;

    /** Which AI rewrite is in flight (null = idle) — drives the pill's disabled/label state. */
    readonly aiBusy = signal<AiImproveMode | null>(null);
    readonly aiError = signal(false);

    constructor(
        private readonly scene: SceneService,
        private readonly history: HistoryService,
        private readonly selection: SelectionService,
        private readonly drawing: DrawingService,
        private readonly textEditing: TextEditingService,
        private readonly api: WhiteboardApiService,
        private readonly host: ElementRef<HTMLElement>,
    ) {
        // A freshly created text/sticky opens directly in edit mode.
        effect(() => {
            const id = this.drawing.editRequest();
            if (!id) return;
            this.drawing.editRequest.set(null);
            this.selection.select(id);
            this.beginEdit(id);
        });
    }

    isText(el: WhiteboardElement): el is TextElement {
        return el.type === 'text';
    }

    isSticky(el: WhiteboardElement): el is StickyElement {
        return el.type === 'sticky';
    }

    /** CSS 3D tilt for the optional X/Y controls (text/sticky have no Z-rotation UI today). */
    tiltTransform(el: WhiteboardElement): string | null {
        const rx = el.rotationX ?? 0;
        const ry = el.rotationY ?? 0;
        return rx || ry ? `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)` : null;
    }

    isEditing(id: string): boolean {
        return this.editingId() === id;
    }

    /**
     * A real `<a href>`'s native click-navigates behavior is unpredictable here — whether it
     * even fires depends on the box's current contenteditable state, and relying on the
     * browser's own "Ctrl/Cmd+click opens a new tab" gesture isn't reliable across every
     * context this runs in either. Handle both outcomes explicitly instead: always prevent the
     * native default, and open the link ourselves only when the modifier is actually held.
     */
    onLinkClick(e: MouseEvent): void {
        const anchor = (e.target as HTMLElement).closest?.('a');
        if (!(anchor instanceof HTMLAnchorElement)) return;
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            window.open(anchor.href, '_blank', 'noopener,noreferrer');
        }
    }

    /** While editing, keep pointer events on the field so the caret works and the board ignores them. */
    onPointerDown(id: string, e: PointerEvent): void {
        // Clicking a checklist glyph toggles it whether or not the box is being edited
        // (Notion/task-list convention) — check this before the normal editing/select handling.
        if (this.tryToggleChecklistGlyph(id, e)) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (this.isEditing(id)) {
            e.stopPropagation();
            return;
        }
        // Not yet editing: let this bubble so the board can select/drag it as usual, but
        // remember its position so a clean click (no drag) on an already-selected box can
        // enter edit mode on release — actually dragging it should just move it instead.
        const el = this.scene.getById(id);
        if (!el) return;
        this.downState = { id, x: el.x, y: el.y, wasSelected: this.selection.isSelected(id) };
    }

    /** A clean click (not a drag) on an already-selected, non-editing box enters edit mode. */
    onPointerUp(id: string, e: PointerEvent): void {
        const down = this.downState;
        this.downState = null;
        if (!down || down.id !== id || !down.wasSelected || this.isEditing(id)) return;
        const el = this.scene.getById(id);
        if (!el || el.x !== down.x || el.y !== down.y) return; // it moved — that was a drag, not a click
        this.beginEdit(id, { x: e.clientX, y: e.clientY });
    }

    /** Double-click enters edit mode; block the surface's own dblclick (which drops new text). */
    onDoubleClick(id: string, e: MouseEvent): void {
        e.stopPropagation();
        // Already editing: this double-click is the user selecting a word, not asking to enter
        // edit mode. Re-running beginEdit here would re-collapse the caret to the click point
        // right after the browser's own native double-click-selects-word behavior had just set
        // it — the word would flash selected for a frame and then immediately lose it.
        if (this.isEditing(id)) return;
        // A real dblclick can fire here purely because two checkbox clicks landed close together
        // in time/space (see `lastGlyphToggleAt` above) — don't let that open edit mode.
        if (Date.now() - this.lastGlyphToggleAt < 500) return;
        this.selection.select(id);
        this.beginEdit(id, { x: e.clientX, y: e.clientY });
    }

    /**
     * Live auto-fit: keep the element's stored size in sync with its actual content. Skipped
     * for text boxes explicitly set to 'fixed' sizing — those keep whatever size the user
     * dragged them to, clipping overflow instead of resizing.
     */
    onInput(id: string, e: Event): void {
        const node = e.target as HTMLElement;
        const patch = this.autoFitPatch(this.scene.getById(id), node);
        if (patch) this.scene.updateElement(id, patch);
        // Native keyboard shortcuts (Ctrl+B etc.) format without moving the selection, so
        // selectionchange alone won't catch them — re-sync the toolbar's active state here too.
        this.textEditing.refreshActiveFormats();
    }

    /**
     * If the clipboard is *purely* a URL, paste it as a link instead of plain text. Mixed
     * content ("check this out: https://...") falls through to the browser's normal paste —
     * only the boundary-key path (onKeyDown) auto-links URLs embedded in longer text.
     */
    onPaste(id: string, e: ClipboardEvent): void {
        const el = this.scene.getById(id);
        if (el?.type === 'text' && el.kind === 'code') return;
        const text = e.clipboardData?.getData('text/plain');
        if (!text) return;
        const anchor = linkifyPastedUrl(text);
        if (!anchor) return;
        e.preventDefault();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(anchor);
        const after = document.createRange();
        after.setStartAfter(anchor);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
    }

    /**
     * Auto-fit height for any text-like element (sticky notes always scroll within their own
     * fixed card size via CSS, so this is a no-op there today, but the check stays generic).
     * Width only auto-fits for plain text boxes, and only matters in 'auto' sizing mode — see
     * the nowrap/pre-wrap split in text-layer.component.scss: a box can't both wrap text to a
     * width AND hug that same width to the text, so 'auto' doesn't wrap at all (grows sideways
     * until Enter), while 'fixed' wraps within — and never resizes — the box's set width.
     */
    private autoFitPatch(el: WhiteboardElement | undefined, node: HTMLElement): Partial<WhiteboardElement> | null {
        if (el?.type === 'text' && el.sizing === 'fixed') return null;
        if (el?.type !== 'text' && el?.type !== 'sticky') return null;
        const patch: Partial<WhiteboardElement> = { height: Math.max(MIN_TEXT_HEIGHT, node.scrollHeight) };
        if (el.type === 'text') patch.width = Math.max(MIN_TEXT_WIDTH, node.scrollWidth);
        return patch;
    }

    /**
     * Continues (or exits) a checklist on Enter, lets Backspace right after an empty checklist
     * marker remove the marker in one step, and auto-links a URL the moment you finish typing
     * it (space/Enter right after — same trigger Notion/Slack use).
     */
    onKeyDown(id: string, e: KeyboardEvent): void {
        if (e.key === ' ' || e.key === 'Enter') {
            const el = this.scene.getById(id);
            // Code Block opts out — a URL in a snippet should stay literal text.
            const skipLink = el?.type === 'text' && el.kind === 'code';
            if (!skipLink) {
                const root = this.host.nativeElement.querySelector<HTMLElement>(`[data-edit-id="${id}"]`);
                if (root) linkifyTokenBeforeCaret(root);
            }
        }

        if (e.key !== 'Enter' && e.key !== 'Backspace') return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
        const root = this.host.nativeElement.querySelector<HTMLElement>(`[data-edit-id="${id}"]`);
        if (!root) return;

        const range = sel.getRangeAt(0);
        const lineContainer = findLineContainer(range.startContainer, range.startOffset, root);
        const startNode = firstTextNode(lineContainer);
        if (!startNode) return;
        const lineText = lineContainer.textContent ?? '';
        if (!isChecklistLine(lineText)) return;
        const markerLen = glyphMarkerLength(startNode.data);
        const restOfLine = lineText.slice(markerLen).trim();

        if (e.key === 'Enter') {
            if (restOfLine === '') {
                // Empty checklist item + Enter: drop the marker instead of continuing the list.
                e.preventDefault();
                startNode.deleteData(0, Math.min(markerLen, startNode.data.length));
                return;
            }
            // Non-empty item: let the browser create the new line as usual, then start it
            // as a checklist item too (deferred so the new line actually exists first).
            setTimeout(() => document.execCommand('insertText', false, '☐ '), 0);
            return;
        }

        // Backspace right after an empty marker (caret sits right at the end of "☐ ") removes it.
        const caretAtMarkerEnd = range.startContainer === startNode && range.startOffset === markerLen;
        if (caretAtMarkerEnd && restOfLine === '') {
            e.preventDefault();
            startNode.deleteData(0, markerLen);
        }
    }

    /**
     * "Improve the writing" — sends the box's plain text to the backend Gemini endpoint
     * and swaps in the rewrite. The edit session stays open (the pill swallows mousedown,
     * so the contenteditable never blurs) and the result is committed to history, so a
     * single Ctrl+Z restores the original wording.
     */
    async improveWriting(id: string, mode: AiImproveMode): Promise<void> {
        if (this.aiBusy()) return;
        const div = this.host.nativeElement.querySelector<HTMLElement>(`[data-edit-id="${id}"]`);
        if (!div) return;
        const text = div.innerText.trim();
        if (!text) return;

        this.aiBusy.set(mode);
        this.aiError.set(false);
        try {
            const res = await firstValueFrom(this.api.improveText(text, mode));
            // innerText (not textContent) so the response's newlines become real line breaks.
            div.innerText = res.text;
            const el = this.scene.getById(id);
            this.scene.updateElement(id, { text: div.innerHTML, ...(this.autoFitPatch(el, div) ?? {}) });
            this.history.commit();
            div.focus();
        } catch {
            this.aiError.set(true);
            setTimeout(() => this.aiError.set(false), 3000);
        } finally {
            this.aiBusy.set(null);
        }
    }

    commitText(id: string, e: FocusEvent): void {
        // Font/Weight/Size, the Sizing and Align buttons, and the color pickers all need real
        // DOM focus to work (unlike Bold/Italic/etc, which dodge this with a mousedown
        // preventDefault trick — impossible for a <select> or <input>, which need focus to be
        // usable at all). Clicking any of them blurs the contenteditable first, which used to
        // exit edit mode and drop the selection right as the user tried to apply a style —
        // exactly backwards. Only actually commit when focus is headed somewhere outside the
        // style panel, i.e. the user is genuinely done editing this box.
        const related = e.relatedTarget as HTMLElement | null;
        if (related?.closest('.wb-panel')) return;

        const div = e.target as HTMLDivElement;
        const el = this.scene.getById(id);
        // A text/code box committed with no actual text is invisible and unselectable by eye —
        // it would just litter the document and the layers panel forever. Discard it instead
        // (sticky notes stay: an empty sticky is still a visible card).
        if (el?.type === 'text' && div.innerText.trim() === '') {
            this.scene.removeElement(id);
            this.history.commit();
            this.textEditing.clear(id);
            if (this.selection.isSelected(id)) this.selection.clear();
            if (this.editingId() === id) this.editingId.set(null);
            return;
        }
        // Catches a URL typed as the very last thing in the box, with no trailing space/Enter
        // to have triggered onKeyDown's linkifyTokenBeforeCaret — e.g. type a link and just
        // click away. Code Block still opts out.
        if (!(el?.type === 'text' && el.kind === 'code')) linkifyTrailingUrl(div);
        // Same auto-fit as onInput — otherwise a fixed-size box snaps back to fit-content size
        // the instant you finish editing, undoing the whole point of fixed sizing right when
        // you'd actually see the result.
        const patch: Partial<WhiteboardElement> = { text: div.innerHTML, ...this.autoFitPatch(el, div) };
        this.scene.updateElement(id, patch);
        this.history.commit();
        this.textEditing.clear(id);
        if (this.editingId() === id) this.editingId.set(null);
    }

    /**
     * @param point Client coordinates to place the caret at (e.g. where the user clicked/
     * double-clicked). Omitted for a freshly-created, still-empty box, where there's no
     * meaningful click position and the caret should just land at the end.
     */
    private beginEdit(id: string, point?: { x: number; y: number }): void {
        this.editingId.set(id);
        // Focus once change detection has flipped `contenteditable` to true — a div that
        // is still contenteditable="false" is not focusable, so focusing too early no-ops.
        this.focusWhenEditable(id, 0, point);
    }

    private focusWhenEditable(id: string, attempt: number, point?: { x: number; y: number }): void {
        if (this.editingId() !== id || attempt > 10) return;
        const node = this.host.nativeElement.querySelector<HTMLElement>(`[data-edit-id="${id}"]`);
        if (node && node.getAttribute('contenteditable') === 'true') {
            node.focus();
            // Re-entering edit mode used to always collapse the caret to the very end of the
            // box's content, no matter where the user clicked — so placing the checklist
            // marker "on the line I clicked" actually meant "on the last line" instead.
            const caret = point && caretPositionAt(point.x, point.y);
            const range = document.createRange();
            if (caret && node.contains(caret.node)) {
                range.setStart(caret.node, caret.offset);
                range.collapse(true);
            } else {
                range.selectNodeContents(node);
                range.collapse(false);
            }
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            this.textEditing.register(id, node);
            return;
        }
        setTimeout(() => this.focusWhenEditable(id, attempt + 1, point), 16);
    }

    /**
     * Shows a pointer cursor while hovering directly over a checklist glyph, so it reads as
     * clickable — same idea as `tryToggleChecklistGlyph`'s hit-test, kept as a separate,
     * read-only copy rather than sharing code with it, since that toggle logic has broken in
     * subtle ways before and isn't worth the risk of coupling to a hover-only concern.
     */
    onPointerMove(id: string, e: PointerEvent): void {
        const node = this.host.nativeElement.querySelector<HTMLElement>(`[data-edit-id="${id}"]`);
        if (!node) return;
        node.style.cursor = hitTestChecklistGlyph(node, e.clientX, e.clientY) ? 'pointer' : '';
    }

    /**
     * Hit-tests a click against a checklist glyph (☐/☑) at the very start of its line and, if
     * hit, flips it and strikes through the rest of that line. Works whether or not the box is
     * currently in edit mode, so checking off a task doesn't require entering edit mode first.
     *
     * Read-only DOM/geometry checks only until a hit is confirmed — this used to probe by
     * collapsing and extending the real `window.getSelection()` on every single pointerdown
     * (even when nowhere near a glyph), which stomped on the user's own in-progress
     * text-selection drag and made normal selecting nearly unusable.
     */
    private tryToggleChecklistGlyph(id: string, e: PointerEvent): boolean {
        const node = this.host.nativeElement.querySelector<HTMLElement>(`[data-edit-id="${id}"]`);
        if (!node) return false;
        const caret = caretPositionAt(e.clientX, e.clientY);
        if (!caret) return false;

        const lineContainer = findLineContainer(caret.node, caret.offset, node);
        const lineText = lineContainer.textContent ?? '';
        if (!isChecklistLine(lineText)) return false;

        const startNode = firstTextNode(lineContainer);
        if (!startNode || !startNode.length) return false;

        // Only treat this as a glyph hit if the click physically landed on the glyph
        // character's own box, measured via a throwaway Range (no selection touched).
        const glyphRange = document.createRange();
        glyphRange.setStart(startNode, 0);
        glyphRange.setEnd(startNode, 1);
        const rect = glyphRange.getBoundingClientRect();
        const pad = 6;
        if (e.clientX < rect.left - pad || e.clientX > rect.right + pad
            || e.clientY < rect.top - pad || e.clientY > rect.bottom + pad) {
            return false;
        }

        // Confirmed hit — safe to touch the selection now, purely to toggle the line's strike.
        const wasChecked = lineText.startsWith('☑');
        const charRange = document.createRange();
        charRange.setStart(startNode, 0);
        charRange.setEnd(startNode, 1);
        charRange.deleteContents();
        const glyphNode = document.createTextNode(wasChecked ? '☐' : '☑');
        charRange.insertNode(glyphNode);

        // Deterministically force the rest of the line to the *correct* struck state, rather
        // than asking execCommand to "toggle" based on document.queryCommandState — that state
        // read goes false for a *partially*-struck line (mixed formatting reads as "not
        // struck" to the browser), so a line already left inconsistent by an earlier toggle
        // could get toggled the wrong way again. Unwrap-then-rewrap always lands on the right
        // answer regardless of whatever state the line was actually in beforehand.
        setLineStrike(glyphNode, !wasChecked);

        const sel = window.getSelection();
        if (sel) {
            // `setBaseAndExtent` to a collapsed point — never leaves the selection at zero
            // ranges (unlike removeAllRanges()), which is what makes Chrome silently blur the
            // contenteditable and exit edit mode mid-click.
            sel.setBaseAndExtent(glyphNode, glyphNode.length, glyphNode, glyphNode.length);
        }

        this.scene.updateElement(id, { text: node.innerHTML } as Partial<WhiteboardElement>);
        this.history.commit();
        this.lastGlyphToggleAt = Date.now();
        return true;
    }
}

/** Read-only: does (clientX, clientY) land on a checklist glyph's own character box? */
function hitTestChecklistGlyph(root: HTMLElement, clientX: number, clientY: number): boolean {
    const caret = caretPositionAt(clientX, clientY);
    if (!caret) return false;
    const lineContainer = findLineContainer(caret.node, caret.offset, root);
    const lineText = lineContainer.textContent ?? '';
    if (!isChecklistLine(lineText)) return false;
    const startNode = firstTextNode(lineContainer);
    if (!startNode || !startNode.length) return false;
    const glyphRange = document.createRange();
    glyphRange.setStart(startNode, 0);
    glyphRange.setEnd(startNode, 1);
    const rect = glyphRange.getBoundingClientRect();
    const pad = 6;
    return clientX >= rect.left - pad && clientX <= rect.right + pad
        && clientY >= rect.top - pad && clientY <= rect.bottom + pad;
}

/** Every sibling of `glyphNode` up to (not including) the next block boundary — "the rest of the line". */
function collectLineTail(glyphNode: Node): ChildNode[] {
    const nodes: ChildNode[] = [];
    let sib = glyphNode.nextSibling;
    while (sib && sib.nodeName !== 'DIV' && sib.nodeName !== 'BR') {
        nodes.push(sib);
        sib = sib.nextSibling;
    }
    return nodes;
}

/**
 * Forces the rest of the checklist line to exactly the requested struck state — always
 * unwraps any existing `<s>`/`<strike>` first (discarding whatever mixed state was already
 * there), then re-wraps in one fresh `<s>` if `struck` is true. Deterministic in both
 * directions, unlike toggling off `document.queryCommandState`'s read of the current state.
 */
function setLineStrike(glyphNode: Node, struck: boolean): void {
    for (const n of collectLineTail(glyphNode)) {
        if (n.nodeType === Node.ELEMENT_NODE && /^(S|STRIKE)$/.test((n as Element).tagName)) {
            const parent = n.parentNode;
            if (!parent) continue;
            while (n.firstChild) parent.insertBefore(n.firstChild, n);
            parent.removeChild(n);
        }
    }
    if (!struck) return;
    const flat = collectLineTail(glyphNode);
    if (flat.length === 0) return;
    const s = document.createElement('s');
    flat[0].parentNode!.insertBefore(s, flat[0]);
    for (const n of flat) s.appendChild(n);
}

/** Cross-browser caret-from-point lookup (Chromium/WebKit + Firefox). */
function caretPositionAt(x: number, y: number): { node: Node; offset: number } | null {
    const anyDoc = document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    if (anyDoc.caretRangeFromPoint) {
        const range = anyDoc.caretRangeFromPoint(x, y);
        return range ? { node: range.startContainer, offset: range.startOffset } : null;
    }
    if (anyDoc.caretPositionFromPoint) {
        const pos = anyDoc.caretPositionFromPoint(x, y);
        return pos ? { node: pos.offsetNode, offset: pos.offset } : null;
    }
    return null;
}
