import { Injectable, signal, inject } from '@angular/core';
import { SoundService } from './sound.service';

export type FrontToastType = 'success' | 'error' | 'info';

export interface FrontToast {
    id: number;
    type: FrontToastType;
    message: string;
    duration: number;
}

@Injectable({ providedIn: 'root' })
export class FrontToastService {
    private readonly sound = inject(SoundService);
    readonly toasts = signal<FrontToast[]>([]);
    private nextId = 0;
    private timers = new Map<number, ReturnType<typeof setTimeout>>();
    private timerMeta = new Map<number, { startTime: number; remaining: number }>();

    show(message: string, type: FrontToastType = 'info', duration = 5000): number {
        const id = ++this.nextId;
        this.toasts.update(list => [{ id, type, message, duration }, ...list]);
        this.sound.play(type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
        this._schedule(id, duration);
        return id;
    }

    success(message: string, duration = 5000): number { return this.show(message, 'success', duration); }
    error(message: string, duration = 6000): number { return this.show(message, 'error', duration); }
    info(message: string, duration = 5000): number { return this.show(message, 'info', duration); }

    pauseToast(id: number): void {
        clearTimeout(this.timers.get(id));
        this.timers.delete(id);
        const meta = this.timerMeta.get(id);
        if (meta) {
            const elapsed = Date.now() - meta.startTime;
            meta.remaining = Math.max(0, meta.remaining - elapsed);
        }
    }

    resumeToast(id: number): void {
        const meta = this.timerMeta.get(id);
        if (!meta) return;
        if (meta.remaining <= 0) { this.dismiss(id); return; }
        this._schedule(id, meta.remaining);
    }

    dismiss(id: number): void {
        clearTimeout(this.timers.get(id));
        this.timers.delete(id);
        this.timerMeta.delete(id);
        this.toasts.update(list => list.filter(t => t.id !== id));
    }

    private _schedule(id: number, remaining: number): void {
        const timeoutId = setTimeout(() => this.dismiss(id), remaining);
        this.timers.set(id, timeoutId);
        this.timerMeta.set(id, { startTime: Date.now(), remaining });
    }
}
