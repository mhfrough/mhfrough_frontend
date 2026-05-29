import { Component, input, output } from '@angular/core';

/**
 * Shared confirmation modal (e.g. "Are you sure you want to delete?").
 *
 * Usage:
 *   <app-confirm-modal
 *     [title]="'Delete Post'"
 *     [body]="'This action cannot be undone.'"
 *     (confirmed)="executeDelete()"
 *     (cancelled)="cancelDelete()"
 *   />
 *
 * Wrap with @if (deleteTargetId()) so it only renders when needed.
 */
@Component({
    selector: 'app-confirm-modal',
    standalone: true,
    template: `
<div class="admin-modal-overlay" (click)="cancelled.emit()">
    <div class="admin-modal" (click)="$event.stopPropagation()">
        <p class="admin-modal-title">{{ title() }}</p>
        <p class="admin-modal-body">{{ body() }}</p>
        <div class="admin-modal-actions">
            <button class="btn-ghost" (click)="cancelled.emit()">{{ cancelLabel() }}</button>
            <button [class]="danger() ? 'btn-danger' : 'btn-primary'" (click)="confirmed.emit()">{{ confirmLabel() }}</button>
        </div>
    </div>
</div>
`,
    styles: [':host { display: contents; }'],
})
export class ConfirmModalComponent {
    readonly title = input.required<string>();
    readonly body = input('This action cannot be undone.');
    readonly confirmLabel = input('Delete');
    readonly cancelLabel = input('Cancel');
    readonly danger = input(true);

    readonly confirmed = output<void>();
    readonly cancelled = output<void>();
}
