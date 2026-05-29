import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type SoundType = 'success' | 'error' | 'info' | 'notification';

@Injectable({ providedIn: 'root' })
export class SoundService {
    private readonly platformId = inject(PLATFORM_ID);
    private ctx: AudioContext | null = null;

    private getCtx(): AudioContext | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        if (!this.ctx) {
            try {
                this.ctx = new AudioContext();
            } catch {
                return null;
            }
        }
        return this.ctx;
    }

    private tone(ctx: AudioContext, freq: number, start: number, duration: number, volume = 0.18): void {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.01);
        gain.gain.setValueAtTime(volume, start + duration - 0.02);
        gain.gain.linearRampToValueAtTime(0, start + duration);
        osc.start(start);
        osc.stop(start + duration);
    }

    play(type: SoundType): void {
        const ctx = this.getCtx();
        if (!ctx) return;

        // Resume AudioContext if suspended (browser autoplay policy)
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => this.playSound(ctx, type));
            return;
        }
        this.playSound(ctx, type);
    }

    private playSound(ctx: AudioContext, type: SoundType): void {
        const now = ctx.currentTime;
        switch (type) {
            case 'success':
                // Ascending: low → high
                this.tone(ctx, 440, now, 0.09);
                this.tone(ctx, 660, now + 0.1, 0.09);
                this.tone(ctx, 880, now + 0.2, 0.12, 0.14);
                break;
            case 'error':
                // Descending: high → low
                this.tone(ctx, 880, now, 0.09);
                this.tone(ctx, 540, now + 0.1, 0.12, 0.16);
                break;
            case 'info':
                // Single neutral chime
                this.tone(ctx, 660, now, 0.12, 0.14);
                break;
            case 'notification':
                // Two quick ascending tones
                this.tone(ctx, 660, now, 0.07);
                this.tone(ctx, 880, now + 0.09, 0.1, 0.15);
                break;
        }
    }
}
