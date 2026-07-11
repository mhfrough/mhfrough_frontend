import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

const ROWS = 5;
const COLS = 8;
const PADDLE_W_RATIO = 0.22;
const PADDLE_H = 8;
const BALL_SIZE = 6;
const HIGH_SCORE_KEY = 'mh-breakout-high-score';

interface Brick {
    alive: boolean;
    x: number;
    y: number;
    w: number;
    h: number;
}

@Component({
    selector: 'app-breakout',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './breakout.component.html',
    styleUrl: './breakout.component.scss',
})
export class BreakoutComponent implements OnInit, OnDestroy {
    @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

    private readonly seo = inject(SeoService);
    private readonly platformId = inject(PLATFORM_ID);
    private ctx!: CanvasRenderingContext2D;
    private raf: number | null = null;
    private w = 0;
    private h = 0;

    private paddleX = 0;
    private paddleW = 0;
    private ballX = 0;
    private ballY = 0;
    private ballVX = 0;
    private ballVY = 0;
    private bricks: Brick[] = [];
    private moveLeft = false;
    private moveRight = false;

    readonly score = signal(0);
    readonly highScore = signal(0);
    readonly lives = signal(3);
    readonly status = signal<'idle' | 'playing' | 'paused' | 'won' | 'lost'>('idle');

    ngOnInit(): void {
        this.seo.update({
            title: 'Breakout | Games | Mohammad Hamza',
            description: 'A monochrome Breakout/brick-breaker built with canvas. Clear every brick without dropping the ball.',
            url: '/games/breakout',
        });

        if (isPlatformBrowser(this.platformId)) {
            this.highScore.set(Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0));
        }

        const canvas = this.canvasRef.nativeElement;
        this.ctx = canvas.getContext('2d')!;
        this.sizeCanvas();
        this.buildBricks();
        this.resetBall();
        this.draw();
    }

    ngOnDestroy(): void {
        this.stopLoop();
    }

    @HostListener('window:resize')
    onResize() {
        this.sizeCanvas();
        this.buildBricks();
        this.draw();
    }

    private sizeCanvas() {
        const canvas = this.canvasRef.nativeElement;
        const dpr = window.devicePixelRatio || 1;
        this.w = canvas.clientWidth;
        this.h = canvas.clientHeight;
        canvas.width = this.w * dpr;
        canvas.height = this.h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.paddleW = this.w * PADDLE_W_RATIO;
        this.paddleX = (this.w - this.paddleW) / 2;
    }

    private buildBricks() {
        this.bricks = [];
        const gap = 3;
        const top = 30;
        const brickW = (this.w - gap * (COLS + 1)) / COLS;
        const brickH = 14;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                this.bricks.push({
                    alive: true,
                    x: gap + c * (brickW + gap),
                    y: top + r * (brickH + gap),
                    w: brickW,
                    h: brickH,
                });
            }
        }
    }

    private resetBall() {
        this.ballX = this.w / 2;
        this.ballY = this.h - 40;
        this.ballVX = 2.4 * (Math.random() > 0.5 ? 1 : -1);
        this.ballVY = -3;
        this.paddleX = (this.w - this.paddleW) / 2;
    }

    start() {
        if (this.status() === 'playing') return;
        if (this.status() === 'idle' || this.status() === 'won' || this.status() === 'lost') {
            this.score.set(0);
            this.lives.set(3);
            this.buildBricks();
            this.resetBall();
        }
        this.status.set('playing');
        this.stopLoop();
        this.loop();
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
        this.score.set(0);
        this.lives.set(3);
        this.buildBricks();
        this.resetBall();
        this.draw();
    }

    private stopLoop() {
        if (this.raf !== null) {
            cancelAnimationFrame(this.raf);
            this.raf = null;
        }
    }

    private loop = () => {
        this.update();
        this.draw();
        if (this.status() === 'playing') {
            this.raf = requestAnimationFrame(this.loop);
        }
    };

    private update() {
        if (this.moveLeft) this.paddleX -= 5.5;
        if (this.moveRight) this.paddleX += 5.5;
        this.paddleX = Math.max(0, Math.min(this.w - this.paddleW, this.paddleX));

        this.ballX += this.ballVX;
        this.ballY += this.ballVY;

        if (this.ballX <= BALL_SIZE / 2 || this.ballX >= this.w - BALL_SIZE / 2) this.ballVX *= -1;
        if (this.ballY <= BALL_SIZE / 2) this.ballVY *= -1;

        const paddleY = this.h - PADDLE_H - 10;
        if (
            this.ballVY > 0 &&
            this.ballY >= paddleY - BALL_SIZE / 2 &&
            this.ballY <= paddleY + PADDLE_H &&
            this.ballX >= this.paddleX &&
            this.ballX <= this.paddleX + this.paddleW
        ) {
            const hitPos = (this.ballX - (this.paddleX + this.paddleW / 2)) / (this.paddleW / 2);
            this.ballVX = hitPos * 4;
            this.ballVY = -Math.abs(this.ballVY);
        }

        for (const brick of this.bricks) {
            if (!brick.alive) continue;
            if (
                this.ballX + BALL_SIZE / 2 > brick.x &&
                this.ballX - BALL_SIZE / 2 < brick.x + brick.w &&
                this.ballY + BALL_SIZE / 2 > brick.y &&
                this.ballY - BALL_SIZE / 2 < brick.y + brick.h
            ) {
                brick.alive = false;
                this.ballVY *= -1;
                this.score.update(v => v + 10);
                break;
            }
        }

        if (this.ballY > this.h) {
            this.lives.update(v => v - 1);
            if (this.lives() <= 0) {
                this.endGame('lost');
            } else {
                this.resetBall();
            }
        }

        if (this.bricks.every(b => !b.alive)) {
            this.endGame('won');
        }
    }

    private endGame(result: 'won' | 'lost') {
        this.status.set(result);
        this.stopLoop();
        if (this.score() > this.highScore()) {
            this.highScore.set(this.score());
            if (isPlatformBrowser(this.platformId)) {
                localStorage.setItem(HIGH_SCORE_KEY, String(this.score()));
            }
        }
    }

    private draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(0, 0, this.w, this.h);

        ctx.fillStyle = '#d0d0d0';
        for (const brick of this.bricks) {
            if (brick.alive) ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        }

        ctx.fillRect(this.paddleX, this.h - PADDLE_H - 10, this.paddleW, PADDLE_H);
        ctx.fillRect(this.ballX - BALL_SIZE / 2, this.ballY - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);
    }

    @HostListener('window:keydown', ['$event'])
    onKeydown(e: KeyboardEvent) {
        if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) e.preventDefault();
        if (e.key === 'ArrowLeft' || e.key === 'a') this.moveLeft = true;
        if (e.key === 'ArrowRight' || e.key === 'd') this.moveRight = true;
        if (e.key === ' ') {
            e.preventDefault();
            this.status() === 'playing' ? this.pause() : this.start();
        }
    }

    @HostListener('window:keyup', ['$event'])
    onKeyup(e: KeyboardEvent) {
        if (e.key === 'ArrowLeft' || e.key === 'a') this.moveLeft = false;
        if (e.key === 'ArrowRight' || e.key === 'd') this.moveRight = false;
    }

    pressStart(dir: 'left' | 'right') {
        if (dir === 'left') this.moveLeft = true; else this.moveRight = true;
        if (this.status() === 'idle') this.start();
    }

    pressEnd(dir: 'left' | 'right') {
        if (dir === 'left') this.moveLeft = false; else this.moveRight = false;
    }
}
