import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

const ROWS = 4;
const COLS = 8;
const ENEMY_SIZE = 16;
const SHIP_W = 22;
const SHIP_H = 10;
const BULLET_W = 3;
const BULLET_H = 8;
const HIGH_SCORE_KEY = 'mh-invaders-high-score';

interface Enemy {
    alive: boolean;
    x: number;
    y: number;
}

interface Bullet {
    x: number;
    y: number;
}

@Component({
    selector: 'app-space-invaders',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './space-invaders.component.html',
    styleUrl: './space-invaders.component.scss',
})
export class SpaceInvadersComponent implements OnInit, OnDestroy {
    @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

    private readonly seo = inject(SeoService);
    private readonly platformId = inject(PLATFORM_ID);
    private ctx!: CanvasRenderingContext2D;
    private raf: number | null = null;
    private w = 0;
    private h = 0;

    private shipX = 0;
    private enemies: Enemy[] = [];
    private enemyDir = 1;
    private enemySpeed = 0.5;
    private playerBullets: Bullet[] = [];
    private enemyBullets: Bullet[] = [];

    private moveLeft = false;
    private moveRight = false;
    private lastShot = 0;
    private lastEnemyShot = 0;

    readonly score = signal(0);
    readonly highScore = signal(0);
    readonly lives = signal(3);
    readonly status = signal<'idle' | 'playing' | 'paused' | 'won' | 'lost'>('idle');

    ngOnInit(): void {
        this.seo.update({
            title: 'Space Invaders | Games | Mohammad Hamza',
            description: 'A monochrome Space Invaders clone built with canvas. Clear the wave before it reaches you.',
            url: '/games/space-invaders',
        });

        if (isPlatformBrowser(this.platformId)) {
            this.highScore.set(Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0));
        }

        const canvas = this.canvasRef.nativeElement;
        this.ctx = canvas.getContext('2d')!;
        this.sizeCanvas();
        this.buildWave();
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
        this.shipX = this.w / 2;
    }

    private buildWave() {
        this.enemies = [];
        const gap = 10;
        const top = 24;
        const totalW = COLS * ENEMY_SIZE + (COLS - 1) * gap;
        const startX = (this.w - totalW) / 2;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                this.enemies.push({
                    alive: true,
                    x: startX + c * (ENEMY_SIZE + gap),
                    y: top + r * (ENEMY_SIZE + gap),
                });
            }
        }
        this.enemyDir = 1;
        this.enemySpeed = 0.5;
        this.playerBullets = [];
        this.enemyBullets = [];
    }

    start() {
        if (this.status() === 'playing') return;
        if (this.status() === 'idle' || this.status() === 'won' || this.status() === 'lost') {
            this.score.set(0);
            this.lives.set(3);
            this.shipX = this.w / 2;
            this.buildWave();
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
        this.shipX = this.w / 2;
        this.buildWave();
        this.draw();
    }

    private stopLoop() {
        if (this.raf !== null) {
            cancelAnimationFrame(this.raf);
            this.raf = null;
        }
    }

    private loop = (time?: number) => {
        this.update(time ?? performance.now());
        this.draw();
        if (this.status() === 'playing') {
            this.raf = requestAnimationFrame(this.loop);
        }
    };

    private update(time: number) {
        const shipSpeed = 4.5;
        if (this.moveLeft) this.shipX -= shipSpeed;
        if (this.moveRight) this.shipX += shipSpeed;
        this.shipX = Math.max(SHIP_W / 2, Math.min(this.w - SHIP_W / 2, this.shipX));

        const alive = this.enemies.filter(e => e.alive);
        let hitEdge = false;
        for (const e of alive) {
            e.x += this.enemyDir * this.enemySpeed;
            if (e.x <= 0 || e.x + ENEMY_SIZE >= this.w) hitEdge = true;
        }
        if (hitEdge) {
            this.enemyDir *= -1;
            for (const e of alive) e.y += 12;
        }

        this.playerBullets.forEach(b => (b.y -= 6));
        this.playerBullets = this.playerBullets.filter(b => b.y > -BULLET_H);

        this.enemyBullets.forEach(b => (b.y += 3.5));
        this.enemyBullets = this.enemyBullets.filter(b => b.y < this.h + BULLET_H);

        if (time - this.lastEnemyShot > 900 && alive.length) {
            this.lastEnemyShot = time;
            const shooter = alive[Math.floor(Math.random() * alive.length)];
            this.enemyBullets.push({ x: shooter.x + ENEMY_SIZE / 2, y: shooter.y + ENEMY_SIZE });
        }

        for (const bullet of this.playerBullets) {
            for (const e of alive) {
                if (!e.alive) continue;
                if (
                    bullet.x > e.x && bullet.x < e.x + ENEMY_SIZE &&
                    bullet.y > e.y && bullet.y < e.y + ENEMY_SIZE
                ) {
                    e.alive = false;
                    bullet.y = -999;
                    this.score.update(v => v + 20);
                }
            }
        }
        this.playerBullets = this.playerBullets.filter(b => b.y > -BULLET_H);

        const shipY = this.h - SHIP_H - 10;
        for (const bullet of this.enemyBullets) {
            if (
                bullet.x > this.shipX - SHIP_W / 2 && bullet.x < this.shipX + SHIP_W / 2 &&
                bullet.y > shipY && bullet.y < shipY + SHIP_H
            ) {
                bullet.y = this.h + 999;
                this.loseLife();
            }
        }
        this.enemyBullets = this.enemyBullets.filter(b => b.y < this.h + BULLET_H);

        if (alive.some(e => e.y + ENEMY_SIZE >= shipY)) {
            this.endGame('lost');
        }

        if (!this.enemies.some(e => e.alive)) {
            this.endGame('won');
        }
    }

    private loseLife() {
        this.lives.update(v => v - 1);
        if (this.lives() <= 0) this.endGame('lost');
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

    private fire() {
        if (this.status() !== 'playing') return;
        const now = performance.now();
        if (now - this.lastShot < 350) return;
        this.lastShot = now;
        this.playerBullets.push({ x: this.shipX, y: this.h - SHIP_H - 14 });
    }

    private draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(0, 0, this.w, this.h);

        ctx.fillStyle = '#d0d0d0';
        for (const e of this.enemies) {
            if (e.alive) ctx.fillRect(e.x, e.y, ENEMY_SIZE, ENEMY_SIZE);
        }

        for (const b of this.playerBullets) ctx.fillRect(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H);
        for (const b of this.enemyBullets) ctx.fillRect(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H);

        const shipY = this.h - SHIP_H - 10;
        ctx.fillRect(this.shipX - SHIP_W / 2, shipY, SHIP_W, SHIP_H);
    }

    @HostListener('window:keydown', ['$event'])
    onKeydown(e: KeyboardEvent) {
        if (['ArrowLeft', 'ArrowRight', 'a', 'd', ' '].includes(e.key)) e.preventDefault();
        if (e.key === 'ArrowLeft' || e.key === 'a') this.moveLeft = true;
        if (e.key === 'ArrowRight' || e.key === 'd') this.moveRight = true;
        if (e.key === ' ') {
            if (this.status() === 'playing') this.fire();
            else this.start();
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

    pressFire() {
        if (this.status() === 'idle') this.start();
        else this.fire();
    }
}
