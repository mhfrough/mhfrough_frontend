import { Injectable, signal } from '@angular/core';

export type FrontToastType = 'success' | 'error' | 'info';

export interface FrontToast {
    id: number;
    type: FrontToastType;
    message: string;
    duration: number;
}

@Injectable({ providedIn: 'root' })
export class FrontToastService {
    readonly toasts = signal<FrontToast[]>([]);
    private nextId = 0;

    show(message: string, type: FrontToastType = 'info', duration = 5000): number {
        const id = ++this.nextId;
        // New toast goes to the front (top of stack)
        this.toasts.update(list => [{ id, type, message, duration }, ...list]);
        setTimeout(() => this.dismiss(id), duration);
        return id;
    }

    success(message: string, duration = 5000): number { return this.show(message, 'success', duration); }
    error(message: string, duration = 6000): number { return this.show(message, 'error', duration); }
    info(message: string, duration = 5000): number { return this.show(message, 'info', duration); }

    dismiss(id: number): void {
        this.toasts.update(list => list.filter(t => t.id !== id));
    }
}
