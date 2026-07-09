import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Output } from '@angular/core';
import { TOOL_DEFS } from '../../core/models/tool.model';

interface ShortcutRow {
    keys: string[];
    label: string;
}

/** V, Shift+R, Ctrl+Z → [['V'], ['Shift', 'R'], ['Ctrl', 'Z']] for individual keycap rendering. */
function splitKeys(shortcut: string): string[] {
    return shortcut.split('+');
}

const TOOL_SHORTCUTS: ShortcutRow[] = TOOL_DEFS.map(t => ({ keys: splitKeys(t.shortcut), label: t.label }));

/**
 * Kept as static data, not derived from canvas-board.component.ts — those are inline `if`
 * branches on a KeyboardEvent, not a lookup table, so there's nothing to reuse. Keep this in
 * sync by hand if `onKeyDown` there changes. Deliberately excludes bring-to-front/back and
 * align: those exist (selection.service.ts) but are only reachable from the right-click menu
 * and the selection toolbar today — no keyboard binding to document here.
 */
const EDITOR_SHORTCUTS: ShortcutRow[] = [
    { keys: ['Ctrl', 'Z'], label: 'Undo' },
    { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo' },
    { keys: ['Ctrl', 'Y'], label: 'Redo (alt)' },
    { keys: ['Delete'], label: 'Delete selected' },
    { keys: ['Ctrl', 'D'], label: 'Duplicate' },
    { keys: ['Ctrl', 'C'], label: 'Copy' },
    { keys: ['Ctrl', 'X'], label: 'Cut' },
    { keys: ['Ctrl', 'V'], label: 'Paste' },
    { keys: ['Ctrl', 'G'], label: 'Group selection' },
    { keys: ['Ctrl', 'A'], label: 'Select all' },
    { keys: ['Arrow'], label: 'Nudge selection 1px' },
    { keys: ['Shift', 'Arrow'], label: 'Nudge selection 10px' },
    { keys: ['Space', 'drag'], label: 'Pan canvas' },
    { keys: ['Ctrl', '0'], label: 'Reset view' },
    { keys: ['Esc'], label: 'Cancel / deselect' },
];

@Component({
    selector: 'app-help-modal',
    standalone: true,
    imports: [],
    templateUrl: './help-modal.component.html',
    styleUrl: './help-modal.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpModalComponent {
    @Output() readonly closeModal = new EventEmitter<void>();

    readonly toolShortcuts = TOOL_SHORTCUTS;
    readonly editorShortcuts = EDITOR_SHORTCUTS;

    // Escape should just close this dialog — not also fall through to canvas-board's
    // window-level Escape handler, which cancels drawing and clears the canvas selection.
    // `document` is earlier than `window` in the bubble path, so stopping it here keeps that
    // handler from also running for the same keypress.
    @HostListener('document:keydown', ['$event'])
    onEscape(e: KeyboardEvent): void {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        this.closeModal.emit();
    }

    close(): void {
        this.closeModal.emit();
    }
}
