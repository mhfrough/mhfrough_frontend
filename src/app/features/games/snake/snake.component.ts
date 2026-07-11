import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

type Point = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

const GRID = 20;
const TICK_MS = 130;
const HIGH_SCORE_KEY = 'mh-snake-high-score';

@Component({
    selector: 'app-snake',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './snake.component.html',
    styleUrl: './snake.component.scss',
})
export class SnakeComponent implements OnInit, OnDestroy {
    @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

    private readonly seo = inject(SeoService);
    private readonly platformId = inject(PLATFORM_ID);
    private ctx!: CanvasRenderingContext2D;
    private cell = 0;
    private loopHandle: ReturnType<typeof setInterval> | null = null;

    private snake: Point[] = [];
    private dir: Dir = 'right';
    private nextDir: Dir = 'right';
    private food: Point = { x: 10, y: 10 };

    readonly score = signal(0);
    readonly highScore = signal(0);
    readonly status = signal<'idle' | 'playing' | 'paused' | 'over'>('idle');

    ngOnInit(): void {
        this.seo.update({
            title: 'Snake | Games | Mohammad Hamza',
            description: 'Play a Nokia-3310-style Snake game right in the browser. Canvas, no downloads.',
            url: '/games/snake',
        });

        if (isPlatformBrowser(this.platformId)) {
            this.highScore.set(Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0));
        }

        const canvas = this.canvasRef.nativeElement;
        this.ctx = canvas.getContext('2d')!;
        this.sizeCanvas();
        this.resetBoard();
        this.draw();
    }

    ngOnDestroy(): void {
        this.stopLoop();
    }

    @HostListener('window:resize')
    onResize() {
        this.sizeCanvas();
        this.draw();
    }

    private sizeCanvas() {
        const canvas = this.canvasRef.nativeElement;
        const dpr = window.devicePixelRatio || 1;
        const size = canvas.clientWidth;
        canvas.width = size * dpr;
        canvas.height = canvas.clientHeight * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.cell = Math.min(canvas.clientWidth, canvas.clientHeight) / GRID;
    }

    private resetBoard() {
        this.snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
        this.dir = 'right';
        this.nextDir = 'right';
        this.score.set(0);
        this.placeFood();
    }

    private placeFood() {
        let candidate: Point;
        do {
            candidate = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
        } while (this.snake.some(s => s.x === candidate.x && s.y === candidate.y));
        this.food = candidate;
    }

    start() {
        if (this.status() === 'playing') return;
        if (this.status() === 'idle' || this.status() === 'over') this.resetBoard();
        this.status.set('playing');
        this.stopLoop();
        this.loopHandle = setInterval(() => this.tick(), TICK_MS);
    }

    pause() {
        if (this.status() !== 'playing') return;
        this.status.set('paused');
        this.stopLoop();
        this.draw();
    }

    reset() {
        this.stopLoop();
        this.status.set('idle');
        this.resetBoard();
        this.draw();
    }

    private stopLoop() {
        if (this.loopHandle !== null) {
            clearInterval(this.loopHandle);
            this.loopHandle = null;
        }
    }

    private tick() {
        this.dir = this.nextDir;
        const head = this.snake[0];
        const delta: Record<Dir, Point> = {
            up: { x: 0, y: -1 },
            down: { x: 0, y: 1 },
            left: { x: -1, y: 0 },
            right: { x: 1, y: 0 },
        };
        const d = delta[this.dir];
        const newHead: Point = { x: head.x + d.x, y: head.y + d.y };

        const hitWall = newHead.x < 0 || newHead.y < 0 || newHead.x >= GRID || newHead.y >= GRID;
        const hitSelf = this.snake.some(s => s.x === newHead.x && s.y === newHead.y);

        if (hitWall || hitSelf) {
            this.gameOver();
            return;
        }

        this.snake.unshift(newHead);

        if (newHead.x === this.food.x && newHead.y === this.food.y) {
            this.score.update(v => v + 1);
            this.placeFood();
        } else {
            this.snake.pop();
        }

        this.draw();
    }

    private gameOver() {
        this.stopLoop();
        this.status.set('over');
        if (this.score() > this.highScore()) {
            this.highScore.set(this.score());
            if (isPlatformBrowser(this.platformId)) {
                localStorage.setItem(HIGH_SCORE_KEY, String(this.score()));
            }
        }
        this.draw();
    }

    private draw() {
        const ctx = this.ctx;
        const canvas = this.canvasRef.nativeElement;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;

        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#d0d0d0';
        for (const seg of this.snake) {
            ctx.fillRect(seg.x * this.cell + 1, seg.y * this.cell + 1, this.cell - 2, this.cell - 2);
        }

        ctx.fillRect(this.food.x * this.cell + 3, this.food.y * this.cell + 3, this.cell - 6, this.cell - 6);
    }

    private setDir(next: Dir) {
        const opposite: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
        if (opposite[this.dir] === next) return;
        this.nextDir = next;
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
            this.setDir(dir);
            if (this.status() === 'idle') this.start();
        } else if (e.key === ' ') {
            e.preventDefault();
            this.status() === 'playing' ? this.pause() : this.start();
        }
    }

    press(dir: Dir) {
        this.setDir(dir);
        if (this.status() === 'idle') this.start();
    }
}
