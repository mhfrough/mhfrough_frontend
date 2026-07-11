import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

const WIN_SCORE = 7;
const PADDLE_H_RATIO = 0.22;
const PADDLE_W = 8;
const BALL_SIZE = 8;
const PADDLE_SPEED = 4.2;
const AI_SPEED = 3.1;

type Mode = '1p' | '2p';
type Side = 'left' | 'right';

@Component({
    selector: 'app-ping-pong',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './ping-pong.component.html',
    styleUrl: './ping-pong.component.scss',
})
export class PingPongComponent implements OnInit, OnDestroy {
    @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

    private readonly seo = inject(SeoService);
    private ctx!: CanvasRenderingContext2D;
    private raf: number | null = null;
    private w = 0;
    private h = 0;

    private leftY = 0;
    private rightY = 0;
    private ballX = 0;
    private ballY = 0;
    private ballVX = 0;
    private ballVY = 0;

    private leftUp = false;
    private leftDown = false;
    private rightUp = false;
    private rightDown = false;

    readonly mode = signal<Mode>('1p');
    readonly leftScore = signal(0);
    readonly rightScore = signal(0);
    readonly status = signal<'idle' | 'playing' | 'paused' | 'over'>('idle');
    readonly winner = signal<Side | null>(null);

    ngOnInit(): void {
        this.seo.update({
            title: 'Ping Pong | Games | Mohammad Hamza',
            description: 'Play Pong solo against the CPU, or switch to local two-player. Canvas, no downloads. First to 7 wins.',
            url: '/games/ping-pong',
        });

        const canvas = this.canvasRef.nativeElement;
        this.ctx = canvas.getContext('2d')!;
        this.sizeCanvas();
        this.resetPositions();
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
        this.w = canvas.clientWidth;
        this.h = canvas.clientHeight;
        canvas.width = this.w * dpr;
        canvas.height = this.h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    private resetPositions() {
        this.leftY = this.h / 2;
        this.rightY = this.h / 2;
        this.serveBall();
    }

    private serveBall(direction: 1 | -1 = Math.random() > 0.5 ? 1 : -1) {
        this.ballX = this.w / 2;
        this.ballY = this.h / 2;
        this.ballVX = 3.2 * direction;
        this.ballVY = (Math.random() * 2 - 1) * 2.4;
    }

    toggleMode() {
        this.mode.set(this.mode() === '1p' ? '2p' : '1p');
        this.reset();
    }

    start() {
        if (this.status() === 'playing') return;
        if (this.status() === 'idle' || this.status() === 'over') {
            this.leftScore.set(0);
            this.rightScore.set(0);
            this.winner.set(null);
            this.resetPositions();
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
        this.leftScore.set(0);
        this.rightScore.set(0);
        this.winner.set(null);
        this.resetPositions();
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
        const paddleH = this.h * PADDLE_H_RATIO;

        if (this.leftUp) this.leftY -= PADDLE_SPEED;
        if (this.leftDown) this.leftY += PADDLE_SPEED;
        this.leftY = Math.max(paddleH / 2, Math.min(this.h - paddleH / 2, this.leftY));

        if (this.mode() === '2p') {
            if (this.rightUp) this.rightY -= PADDLE_SPEED;
            if (this.rightDown) this.rightY += PADDLE_SPEED;
            this.rightY = Math.max(paddleH / 2, Math.min(this.h - paddleH / 2, this.rightY));
        } else {
            const aiTarget = this.ballY;
            if (Math.abs(this.rightY - aiTarget) > AI_SPEED) {
                this.rightY += this.rightY < aiTarget ? AI_SPEED : -AI_SPEED;
            }
            this.rightY = Math.max(paddleH / 2, Math.min(this.h - paddleH / 2, this.rightY));
        }

        this.ballX += this.ballVX;
        this.ballY += this.ballVY;

        if (this.ballY <= 0 || this.ballY >= this.h) {
            this.ballVY *= -1;
            this.ballY = Math.max(0, Math.min(this.h, this.ballY));
        }

        const leftPaddleX = PADDLE_W + 4;
        const rightPaddleX = this.w - PADDLE_W - 4;

        if (this.ballVX < 0 && this.ballX <= leftPaddleX + BALL_SIZE && this.ballX > leftPaddleX - 10) {
            if (Math.abs(this.ballY - this.leftY) <= paddleH / 2 + BALL_SIZE) {
                this.ballVX *= -1.05;
                this.ballVY += (this.ballY - this.leftY) * 0.05;
            }
        }

        if (this.ballVX > 0 && this.ballX >= rightPaddleX - BALL_SIZE && this.ballX < rightPaddleX + 10) {
            if (Math.abs(this.ballY - this.rightY) <= paddleH / 2 + BALL_SIZE) {
                this.ballVX *= -1.05;
                this.ballVY += (this.ballY - this.rightY) * 0.05;
            }
        }

        if (this.ballX < 0) {
            this.rightScore.update(v => v + 1);
            this.checkWin('right');
            if (this.status() === 'playing') this.serveBall(1);
        } else if (this.ballX > this.w) {
            this.leftScore.update(v => v + 1);
            this.checkWin('left');
            if (this.status() === 'playing') this.serveBall(-1);
        }
    }

    private checkWin(side: Side) {
        const score = side === 'left' ? this.leftScore() : this.rightScore();
        if (score >= WIN_SCORE) {
            this.winner.set(side);
            this.status.set('over');
            this.stopLoop();
        }
    }

    private draw() {
        const ctx = this.ctx;
        const paddleH = this.h * PADDLE_H_RATIO;

        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(0, 0, this.w, this.h);

        ctx.fillStyle = 'rgba(208,208,208,0.4)';
        for (let y = 0; y < this.h; y += 12) {
            ctx.fillRect(this.w / 2 - 1, y, 2, 6);
        }

        ctx.fillStyle = '#d0d0d0';
        ctx.fillRect(4, this.leftY - paddleH / 2, PADDLE_W, paddleH);
        ctx.fillRect(this.w - PADDLE_W - 4, this.rightY - paddleH / 2, PADDLE_W, paddleH);
        ctx.fillRect(this.ballX - BALL_SIZE / 2, this.ballY - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);
    }

    @HostListener('window:keydown', ['$event'])
    onKeydown(e: KeyboardEvent) {
        if (['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(e.key)) e.preventDefault();
        if (e.key === 'w' || e.key === 'W') this.leftUp = true;
        if (e.key === 's' || e.key === 'S') this.leftDown = true;
        if (e.key === 'ArrowUp') {
            if (this.mode() === '2p') this.rightUp = true; else this.leftUp = true;
        }
        if (e.key === 'ArrowDown') {
            if (this.mode() === '2p') this.rightDown = true; else this.leftDown = true;
        }
        if (e.key === ' ') {
            e.preventDefault();
            this.status() === 'playing' ? this.pause() : this.start();
        }
    }

    @HostListener('window:keyup', ['$event'])
    onKeyup(e: KeyboardEvent) {
        if (e.key === 'w' || e.key === 'W') this.leftUp = false;
        if (e.key === 's' || e.key === 'S') this.leftDown = false;
        if (e.key === 'ArrowUp') {
            if (this.mode() === '2p') this.rightUp = false; else this.leftUp = false;
        }
        if (e.key === 'ArrowDown') {
            if (this.mode() === '2p') this.rightDown = false; else this.leftDown = false;
        }
    }

    pressStart(dir: 'up' | 'down') {
        if (dir === 'up') this.leftUp = true; else this.leftDown = true;
        if (this.status() === 'idle') this.start();
    }

    pressEnd(dir: 'up' | 'down') {
        if (dir === 'up') this.leftUp = false; else this.leftDown = false;
    }
}
