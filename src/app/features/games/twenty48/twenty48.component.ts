import { Component, OnInit, HostListener, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

type Dir = 'up' | 'down' | 'left' | 'right';

const SIZE = 4;
const HIGH_SCORE_KEY = 'mh-2048-high-score';

@Component({
    selector: 'app-twenty48',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './twenty48.component.html',
    styleUrl: './twenty48.component.scss',
})
export class Twenty48Component implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly board = signal<number[][]>(this.emptyBoard());
    readonly score = signal(0);
    readonly highScore = signal(0);
    readonly status = signal<'playing' | 'won' | 'over'>('playing');

    private touchStart: { x: number; y: number } | null = null;

    ngOnInit(): void {
        this.seo.update({
            title: '2048 | Games | Mohammad Hamza',
            description: 'Play 2048 in a Nokia-3310-style monochrome grid. Merge tiles to reach 2048.',
            url: '/games/2048',
        });

        if (isPlatformBrowser(this.platformId)) {
            this.highScore.set(Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0));
        }

        this.newGame();
    }

    private emptyBoard(): number[][] {
        return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    }

    newGame() {
        const board = this.emptyBoard();
        this.board.set(board);
        this.score.set(0);
        this.status.set('playing');
        this.spawnTile();
        this.spawnTile();
    }

    private spawnTile() {
        const board = this.board().map(row => [...row]);
        const empties: [number, number][] = [];
        board.forEach((row, r) => row.forEach((v, c) => { if (v === 0) empties.push([r, c]); }));
        if (empties.length === 0) return;
        const [r, c] = empties[Math.floor(Math.random() * empties.length)];
        board[r][c] = Math.random() < 0.9 ? 2 : 4;
        this.board.set(board);
    }

    private slideRowLeft(row: number[]): { row: number[]; gained: number } {
        const vals = row.filter(v => v !== 0);
        const result: number[] = [];
        let gained = 0;
        for (let i = 0; i < vals.length; i++) {
            if (vals[i] === vals[i + 1]) {
                const merged = vals[i] * 2;
                result.push(merged);
                gained += merged;
                i++;
            } else {
                result.push(vals[i]);
            }
        }
        while (result.length < SIZE) result.push(0);
        return { row: result, gained };
    }

    private transpose(board: number[][]): number[][] {
        return board[0].map((_, c) => board.map(row => row[c]));
    }

    move(dir: Dir) {
        if (this.status() !== 'playing') return;

        let board = this.board().map(row => [...row]);
        let gained = 0;

        const applyLeft = (b: number[][]) => {
            const rows = b.map(row => {
                const { row: newRow, gained: g } = this.slideRowLeft(row);
                gained += g;
                return newRow;
            });
            return rows;
        };

        if (dir === 'left') {
            board = applyLeft(board);
        } else if (dir === 'right') {
            board = applyLeft(board.map(row => [...row].reverse())).map(row => row.reverse());
        } else if (dir === 'up') {
            board = this.transpose(applyLeft(this.transpose(board)));
        } else {
            board = this.transpose(applyLeft(this.transpose(board).map(row => [...row].reverse())).map(row => row.reverse()));
        }

        const changed = JSON.stringify(board) !== JSON.stringify(this.board());
        if (!changed) return;

        this.board.set(board);
        this.score.update(v => v + gained);
        if (this.score() > this.highScore()) {
            this.highScore.set(this.score());
            if (isPlatformBrowser(this.platformId)) {
                localStorage.setItem(HIGH_SCORE_KEY, String(this.score()));
            }
        }

        if (board.some(row => row.includes(2048)) && this.status() === 'playing') {
            this.status.set('won');
            return;
        }

        this.spawnTile();

        if (!this.hasMoves()) {
            this.status.set('over');
        }
    }

    keepPlaying() {
        this.status.set('playing');
    }

    private hasMoves(): boolean {
        const board = this.board();
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (board[r][c] === 0) return true;
                if (c < SIZE - 1 && board[r][c] === board[r][c + 1]) return true;
                if (r < SIZE - 1 && board[r][c] === board[r + 1][c]) return true;
            }
        }
        return false;
    }

    @HostListener('window:keydown', ['$event'])
    onKeydown(e: KeyboardEvent) {
        const map: Record<string, Dir> = {
            ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
            w: 'up', s: 'down', a: 'left', d: 'right',
        };
        const dir = map[e.key];
        if (dir) {
            e.preventDefault();
            this.move(dir);
        }
    }

    onTouchStart(e: TouchEvent) {
        const t = e.touches[0];
        this.touchStart = { x: t.clientX, y: t.clientY };
    }

    onTouchEnd(e: TouchEvent) {
        if (!this.touchStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - this.touchStart.x;
        const dy = t.clientY - this.touchStart.y;
        this.touchStart = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            this.move(dx > 0 ? 'right' : 'left');
        } else {
            this.move(dy > 0 ? 'down' : 'up');
        }
    }

    tileShade(value: number): number {
        if (value === 0) return 0;
        return Math.min(Math.log2(value), 11);
    }
}
