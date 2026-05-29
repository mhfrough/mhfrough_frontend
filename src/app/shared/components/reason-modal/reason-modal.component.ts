import { Component, input, output, signal } from '@angular/core';

/**
 * Shared reason/status modal — shows a title and an optional textarea
 * for a reason/explanation before confirming an action.
 *
 * Usage:
 *   <app-reason-modal
 *     [title]="statusModal()!.title"
 *     (confirmed)="executeStatus($event)"
 *     (cancelled)="cancelStatus()"
 *   />
 *
 * Wrap with @if (statusModal()) so it only renders when needed.
 */
@Component({
    selector: 'app-reason-modal',
    standalone: true,
    template: `
<div class="admin-modal-overlay" (click)="cancelled.emit()">
    <div class="admin-modal" (click)="$event.stopPropagation()">
        <p class="admin-modal-title">{{ title() }}</p>
        <div class="admin-modal-reason">
            <textarea rows="3"
                      [value]="reason()"
                      (input)="reason.set(getVal($event))"
                      [placeholder]="placeholder()">
            </textarea>
        </div>
        <div class="admin-modal-actions">
            <button class="btn-ghost" (click)="cancel()">{{ cancelLabel() }}</button>
            <button class="btn-primary" (click)="confirm()">{{ confirmLabel() }}</button>
        </div>
    </div>
</div>
`,
    styles: [':host { display: contents; }'],
})
export class ReasonModalComponent {
    readonly title = input.required<string>();
    readonly placeholder = input('Reason (optional)');
    readonly confirmLabel = input('Confirm');
    readonly cancelLabel = input('Cancel');

    readonly reason = signal('');

    readonly confirmed = output<string>();
    readonly cancelled = output<void>();

    getVal(e: Event): string {
        return (e.target as HTMLTextAreaElement).value;
    }

    confirm(): void {
        this.confirmed.emit(this.reason());
        this.reason.set('');
    }

    cancel(): void {
        this.reason.set('');
        this.cancelled.emit();
    }
}
