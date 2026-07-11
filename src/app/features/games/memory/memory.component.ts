import { Component, OnInit, OnDestroy, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

const HIGH_SCORE_KEY = 'mh-memory-high-score';
const PAD_COUNT = 4;
const FLASH_MS = 420;
const GAP_MS = 220;

@Component({
    selector: 'app-memory',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './memory.component.html',
    styleUrl: './memory.component.scss',
})
export class MemoryComponent implements OnInit, OnDestroy {
    private readonly seo = inject(SeoService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly round = signal(0);
    readonly highScore = signal(0);
    readonly status = signal<'idle' | 'showing' | 'input' | 'over'>('idle');
    readonly activePad = signal<number | null>(null);
    readonly pads = [0, 1, 2, 3];

    private sequence: number[] = [];
    private playerIndex = 0;
    private timeouts: ReturnType<typeof setTimeout>[] = [];

    ngOnInit(): void {
        this.seo.update({
            title: 'Memory | Games | Mohammad Hamza',
            description: 'A monochrome Simon-style memory game: watch the sequence, then repeat it back.',
            url: '/games/memory',
        });

        if (isPlatformBrowser(this.platformId)) {
            this.highScore.set(Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0));
        }
    }

    ngOnDestroy(): void {
        this.clearTimers();
    }

    private clearTimers() {
        this.timeouts.forEach(t => clearTimeout(t));
        this.timeouts = [];
    }

    private after(ms: number, fn: () => void) {
        this.timeouts.push(setTimeout(fn, ms));
    }

    start() {
        this.clearTimers();
        this.sequence = [];
        this.round.set(0);
        this.status.set('idle');
        this.nextRound();
    }

    private nextRound() {
        this.sequence.push(Math.floor(Math.random() * PAD_COUNT));
        this.round.set(this.sequence.length);
        this.playerIndex = 0;
        this.playSequence();
    }

    private playSequence() {
        this.status.set('showing');
        this.sequence.forEach((pad, i) => {
            this.after(i * (FLASH_MS + GAP_MS), () => {
                this.activePad.set(pad);
                this.after(FLASH_MS, () => this.activePad.set(null));
            });
        });
        this.after(this.sequence.length * (FLASH_MS + GAP_MS), () => {
            this.status.set('input');
        });
    }

    press(pad: number) {
        if (this.status() !== 'input') return;

        this.activePad.set(pad);
        this.after(160, () => this.activePad.set(null));

        if (pad !== this.sequence[this.playerIndex]) {
            this.gameOver();
            return;
        }

        this.playerIndex++;
        if (this.playerIndex === this.sequence.length) {
            this.status.set('idle');
            this.after(600, () => this.nextRound());
        }
    }

    private gameOver() {
        this.status.set('over');
        if (this.round() > this.highScore()) {
            this.highScore.set(this.round());
            if (isPlatformBrowser(this.platformId)) {
                localStorage.setItem(HIGH_SCORE_KEY, String(this.round()));
            }
        }
    }
}
