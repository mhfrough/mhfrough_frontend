import { Component, OnInit, OnDestroy, HostListener, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

const BOARD_W = 10;
const BOARD_H = 20;
const HIGH_SCORE_KEY = 'mh-tetris-high-score';

const PIECE_ORDER: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const PIECE_INDEX: Record<PieceType, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };

const SHAPES: Record<PieceType, number[][][]> = {
    I: [
        [[0, 1], [1, 1], [2, 1], [3, 1]],
        [[2, 0], [2, 1], [2, 2], [2, 3]],
        [[0, 2], [1, 2], [2, 2], [3, 2]],
        [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
    O: [
        [[1, 0], [2, 0], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
    T: [
        [[1, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [1, 1], [2, 1], [1, 2]],
        [[0, 1], [1, 1], [2, 1], [1, 2]],
        [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
    S: [
        [[1, 0], [2, 0], [0, 1], [1, 1]],
        [[1, 0], [1, 1], [2, 1], [2, 2]],
        [[1, 1], [2, 1], [0, 2], [1, 2]],
        [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
    Z: [
        [[0, 0], [1, 0], [1, 1], [2, 1]],
        [[2, 0], [1, 1], [2, 1], [1, 2]],
        [[0, 1], [1, 1], [1, 2], [2, 2]],
        [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
    J: [
        [[0, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [1, 2]],
        [[0, 1], [1, 1], [2, 1], [2, 2]],
        [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
    L: [
        [[2, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [1, 1], [1, 2], [2, 2]],
        [[0, 1], [1, 1], [2, 1], [0, 2]],
        [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
};

interface ActivePiece {
    type: PieceType;
    rotation: number;
    x: number;
    y: number;
}

@Component({
    selector: 'app-tetris',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './tetris.component.html',
    styleUrl: './tetris.component.scss',
})
export class TetrisComponent implements OnInit, OnDestroy {
    private readonly seo = inject(SeoService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly board = signal<number[][]>(this.emptyBoard());
    readonly score = signal(0);
    readonly highScore = signal(0);
    readonly lines = signal(0);
    readonly level = signal(1);
    readonly status = signal<'idle' | 'playing' | 'paused' | 'over'>('idle');
    readonly nextType = signal<PieceType>('I');

    private current: ActivePiece | null = null;
    private bag: PieceType[] = [];
    private timerHandle: ReturnType<typeof setInterval> | null = null;

    ngOnInit(): void {
        this.seo.update({
            title: 'Tetris | Games | Mohammad Hamza',
            description: 'A monochrome Tetris clone built for the browser. Clear lines, chase the high score.',
            url: '/games/tetris',
        });

        if (isPlatformBrowser(this.platformId)) {
            this.highScore.set(Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0));
        }
    }

    ngOnDestroy(): void {
        this.stopTimer();
    }

    private emptyBoard(): number[][] {
        return Array.from({ length: BOARD_H }, () => Array(BOARD_W).fill(0));
    }

    private refillBag() {
        const bag = [...PIECE_ORDER];
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        this.bag.push(...bag);
    }

    private drawFromBag(): PieceType {
        if (this.bag.length === 0) this.refillBag();
        return this.bag.shift()!;
    }

    start() {
        if (this.status() === 'playing') return;
        if (this.status() === 'idle' || this.status() === 'over') {
            this.board.set(this.emptyBoard());
            this.score.set(0);
            this.lines.set(0);
            this.level.set(1);
            this.bag = [];
            this.nextType.set(this.drawFromBag());
            this.spawnPiece();
        }
        this.status.set('playing');
        this.startTimer();
    }

    pause() {
        if (this.status() !== 'playing') return;
        this.status.set('paused');
        this.stopTimer();
    }

    reset() {
        this.stopTimer();
        this.status.set('idle');
        this.board.set(this.emptyBoard());
        this.score.set(0);
        this.lines.set(0);
        this.level.set(1);
        this.current = null;
    }

    private startTimer() {
        this.stopTimer();
        const interval = Math.max(120, 800 - (this.level() - 1) * 70);
        this.timerHandle = setInterval(() => this.tick(), interval);
    }

    private stopTimer() {
        if (this.timerHandle !== null) {
            clearInterval(this.timerHandle);
            this.timerHandle = null;
        }
    }

    private spawnPiece() {
        const type = this.nextType();
        this.nextType.set(this.drawFromBag());
        this.current = { type, rotation: 0, x: 3, y: 0 };
        if (this.collides(this.current)) {
            this.endGame();
        } else {
            this.renderPiece();
        }
    }

    private cellsOf(piece: ActivePiece): [number, number][] {
        return SHAPES[piece.type][piece.rotation].map(([cx, cy]) => [piece.x + cx, piece.y + cy] as [number, number]);
    }

    private collides(piece: ActivePiece): boolean {
        const board = this.board();
        for (const [x, y] of this.cellsOf(piece)) {
            if (x < 0 || x >= BOARD_W || y >= BOARD_H) return true;
            if (y >= 0 && board[y][x] !== 0) return true;
        }
        return false;
    }

    private tick() {
        if (!this.current) return;
        this.clearGhost();
        const moved = { ...this.current, y: this.current.y + 1 };
        if (this.collides(moved)) {
            this.lockPiece();
        } else {
            this.current = moved;
            this.renderPiece();
        }
    }

    private lockPiece() {
        if (!this.current) return;
        const board = this.board().map(row => [...row]);
        for (const [x, y] of this.cellsOf(this.current)) {
            if (y >= 0) board[y][x] = PIECE_INDEX[this.current.type];
        }

        let cleared = 0;
        for (let r = BOARD_H - 1; r >= 0; r--) {
            if (board[r].every(v => v !== 0)) {
                board.splice(r, 1);
                board.unshift(Array(BOARD_W).fill(0));
                cleared++;
                r++;
            }
        }

        this.board.set(board);

        if (cleared > 0) {
            const points = [0, 100, 300, 500, 800][cleared] * this.level();
            this.score.update(v => v + points);
            this.lines.update(v => v + cleared);
            const newLevel = Math.floor(this.lines() / 10) + 1;
            if (newLevel !== this.level()) {
                this.level.set(newLevel);
                if (this.status() === 'playing') this.startTimer();
            }
            if (this.score() > this.highScore()) {
                this.highScore.set(this.score());
                if (isPlatformBrowser(this.platformId)) {
                    localStorage.setItem(HIGH_SCORE_KEY, String(this.score()));
                }
            }
        }

        this.spawnPiece();
        this.renderPiece();
    }

    private endGame() {
        this.status.set('over');
        this.stopTimer();
        this.renderPiece();
    }

    private renderPiece() {
        if (!this.current) return;
        const board = this.board().map(row => [...row]);
        for (const [x, y] of this.cellsOf(this.current)) {
            if (y >= 0 && y < BOARD_H && x >= 0 && x < BOARD_W) board[y][x] = -PIECE_INDEX[this.current.type];
        }
        this.board.set(board);
    }

    private clearGhost() {
        const board = this.board().map(row => row.map(v => (v < 0 ? 0 : v)));
        this.board.set(board);
    }

    private tryMove(dx: number, dy: number): boolean {
        if (!this.current || this.status() !== 'playing') return false;
        this.clearGhost();
        const moved = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
        if (this.collides(moved)) {
            this.renderPiece();
            return false;
        }
        this.current = moved;
        this.renderPiece();
        return true;
    }

    moveLeft() {
        this.tryMove(-1, 0);
    }

    moveRight() {
        this.tryMove(1, 0);
    }

    softDrop() {
        if (!this.tryMove(0, 1)) this.lockPiece();
    }

    hardDrop() {
        if (!this.current || this.status() !== 'playing') return;
        this.clearGhost();
        let piece = { ...this.current };
        while (!this.collides({ ...piece, y: piece.y + 1 })) {
            piece = { ...piece, y: piece.y + 1 };
        }
        this.current = piece;
        this.lockPiece();
    }

    rotate() {
        if (!this.current || this.status() !== 'playing') return;
        this.clearGhost();
        const rotated = { ...this.current, rotation: (this.current.rotation + 1) % 4 };
        if (!this.collides(rotated)) {
            this.current = rotated;
        } else if (!this.collides({ ...rotated, x: rotated.x - 1 })) {
            this.current = { ...rotated, x: rotated.x - 1 };
        } else if (!this.collides({ ...rotated, x: rotated.x + 1 })) {
            this.current = { ...rotated, x: rotated.x + 1 };
        } else {
            this.renderPiece();
            return;
        }
        this.renderPiece();
    }

    cellShade(value: number): number {
        return Math.abs(value);
    }

    @HostListener('window:keydown', ['$event'])
    onKeydown(e: KeyboardEvent) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) e.preventDefault();
        if (this.status() !== 'playing') {
            if (e.key === ' ') this.start();
            return;
        }
        if (e.key === 'ArrowLeft') this.moveLeft();
        if (e.key === 'ArrowRight') this.moveRight();
        if (e.key === 'ArrowDown') this.softDrop();
        if (e.key === 'ArrowUp') this.rotate();
        if (e.key === ' ') this.hardDrop();
    }
}
