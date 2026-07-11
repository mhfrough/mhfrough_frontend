import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Output, inject, signal } from '@angular/core';
import { TOOL_DEFS } from '../../core/models/tool.model';
import { InquiriesService } from '../../../../core/services/inquiry-feedback.service';

interface ShortcutRow {
    keys: string[];
    label: string;
}

type HelpTab = 'shortcuts' | 'guide' | 'feedback';
type FeedbackKind = 'Suggestion' | 'Feedback' | 'Bug report';

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

    private readonly inquiries = inject(InquiriesService);

    readonly toolShortcuts = TOOL_SHORTCUTS;
    readonly editorShortcuts = EDITOR_SHORTCUTS;

    readonly tab = signal<HelpTab>('shortcuts');

    // --- feedback form -------------------------------------------------------
    readonly fbKinds: FeedbackKind[] = ['Suggestion', 'Feedback', 'Bug report'];
    readonly fbKind = signal<FeedbackKind>('Feedback');
    readonly fbName = signal('');
    readonly fbEmail = signal('');
    readonly fbMessage = signal('');
    readonly fbSending = signal(false);
    readonly fbSent = signal(false);
    readonly fbQueued = signal(false);
    readonly fbError = signal('');

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

    /** Mirrors the contact page's CreateInquiryDto limits so validation fails here, not server-side. */
    fbInvalidReason(): string | null {
        if (this.fbName().trim().length < 2) return 'Please enter your name (2+ characters).';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.fbEmail().trim())) return 'Please enter a valid email address.';
        if (this.fbMessage().trim().length < 10) return 'Please describe it in at least 10 characters.';
        return null;
    }

    /**
     * Goes through the same public inquiries API as the site's contact page, so whiteboard
     * feedback shows up in the admin inbox alongside contact messages — the subject prefix
     * is what tells them apart there.
     */
    submitFeedback(): void {
        if (this.fbSending()) return;
        const invalid = this.fbInvalidReason();
        if (invalid) {
            this.fbError.set(invalid);
            return;
        }
        this.fbSending.set(true);
        this.fbError.set('');
        this.inquiries.submit({
            name: this.fbName().trim(),
            email: this.fbEmail().trim(),
            subject: `Whiteboard ${this.fbKind().toLowerCase()}`,
            message: this.fbMessage().trim().slice(0, 2000),
        }).subscribe({
            next: (res: any) => {
                this.fbSending.set(false);
                this.fbSent.set(true);
                this.fbQueued.set(!!res?.queued);
                this.fbMessage.set('');
            },
            error: () => {
                this.fbSending.set(false);
                this.fbError.set('Could not send right now — please try again in a minute.');
            },
        });
    }

    /** Back to the form after the thank-you screen (e.g. to report a second thing). */
    fbReset(): void {
        this.fbSent.set(false);
        this.fbQueued.set(false);
        this.fbError.set('');
    }
}
