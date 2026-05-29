import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FrontToastService } from '../../../core/services/front-toast.service';

@Component({
    selector: 'app-front-toast',
    standalone: true,
    imports: [CommonModule],
    template: `
@if (svc.toasts().length > 0) {
<div class="front-toasts" role="region" aria-live="polite" aria-label="Notifications">
    @for (toast of svc.toasts(); track toast.id) {
    <div class="front-toast" [class]="'front-toast--' + toast.type"
         [class.front-toast--paused]="paused().has(toast.id)"
         (mouseenter)="pause(toast.id)"
         (mouseleave)="resume(toast.id)">
        <div class="front-toast__body">
            @if (toast.type === 'success') {
            <svg class="front-toast__icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            } @else if (toast.type === 'error') {
            <svg class="front-toast__icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
            } @else {
            <svg class="front-toast__icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
            </svg>
            }
            <span class="front-toast__msg">{{ toast.message }}</span>
            <button class="front-toast__close" (click)="svc.dismiss(toast.id)" aria-label="Dismiss notification">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
            </button>
        </div>
        <div class="front-toast__progress" [style.animation-duration]="toast.duration + 'ms'"></div>
    </div>
    }
</div>
}
    `,
})
export class FrontToastComponent {
    readonly svc = inject(FrontToastService);
    readonly paused = signal<Set<number>>(new Set());

    pause(id: number): void {
        this.paused.update(s => new Set([...s, id]));
        this.svc.pauseToast(id);
    }

    resume(id: number): void {
        this.paused.update(s => { const n = new Set(s); n.delete(id); return n; });
        this.svc.resumeToast(id);
    }
}
