import { Component, OnInit, inject, signal, HostBinding, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Title } from '@angular/platform-browser';
import { SoundService } from '../../../core/services/sound.service';
import { RealtimeService } from '../../../core/services/realtime.service';

@Component({
    selector: 'app-admin-login',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule, RouterLink],
    templateUrl: './admin-login.component.html',
})
export class AdminLoginComponent implements OnInit, OnDestroy {
    @HostBinding('attr.data-bs-theme') readonly darkTheme = 'dark';
    private auth = inject(AuthService);
    private router = inject(Router);
    private sound = inject(SoundService);
    private titleService = inject(Title);
    private realtime = inject(RealtimeService);
    readonly loading = signal(false);
    readonly error = signal('');
    readonly warning = signal('');
    readonly lockInfo = signal<{ lockedUntil: Date; remainingSeconds: number } | null>(null);
    readonly unlocked = signal(false);
    readonly showPassword = signal(false);
    readonly rememberMe = signal(false);

    private lockTimer: ReturnType<typeof setInterval> | null = null;
    private realtimeSub?: Subscription;

    ngOnDestroy(): void {
        this.clearTimer();
        this.realtimeSub?.unsubscribe();
    }

    ngOnInit(): void {
        this.titleService.setTitle('Admin Login | Mohammad Hamza');
        this.realtime.connect().then(() => {
            this.realtimeSub = this.realtime.on<unknown>('account_unlocked').subscribe(() => {
                this.lockInfo.set(null);
                this.clearTimer();
                this.unlocked.set(true);
                this.sound.play('success');
            });
        });
    }

    private clearTimer(): void {
        if (this.lockTimer) { clearInterval(this.lockTimer); this.lockTimer = null; }
    }

    private startCountdown(lockedUntil: Date): void {
        this.clearTimer();
        const tick = () => {
            const remaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
            if (remaining <= 0) {
                this.lockInfo.set(null);
                this.clearTimer();
            } else {
                this.lockInfo.update(s => s ? { ...s, remainingSeconds: remaining } : null);
            }
        };
        tick();
        this.lockTimer = setInterval(tick, 1000);
    }

    formatCountdown(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
        return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }

    login(form: NgForm) {
        form.form.markAllAsTouched();
        if (form.invalid) return;

        // Prime AudioContext NOW (inside the user gesture) so async callbacks can play sounds.
        this.sound.prime();

        this.loading.set(true);
        this.error.set('');
        this.warning.set('');
        this.lockInfo.set(null);
        this.auth.login(form.value.email, form.value.password, this.rememberMe()).subscribe({
            next: () => this.router.navigate(['/admin']),
            error: (err) => {
                this.loading.set(false);
                const raw = err?.error;
                const status: number = err?.status ?? 0;

                // Normalise body — handles pre-parsed object, raw JSON string, or empty
                let body: Record<string, unknown> = {};
                if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                    body = raw as Record<string, unknown>;
                } else if (typeof raw === 'string' && raw.trim().startsWith('{')) {
                    try { body = JSON.parse(raw); } catch { /* malformed — body stays {} */ }
                }

                // Extract a human-readable string; reject raw JSON blobs
                const safeStr = (val: unknown, fallback: string): string => {
                    if (typeof val !== 'string') return fallback;
                    const s = val.trim();
                    if (!s || s.startsWith('{') || s.startsWith('[')) return fallback;
                    return s;
                };

                if (status === 423 || body['error'] === 'account_locked') {
                    const lockedUntil = body['lockedUntil']
                        ? new Date(body['lockedUntil'] as string)
                        : new Date(Date.now() + ((body['remainingMinutes'] as number) ?? 180) * 60 * 1000);
                    this.lockInfo.set({ lockedUntil, remainingSeconds: 0 });
                    this.startCountdown(lockedUntil);
                    this.sound.play('error');
                } else if (status === 401) {
                    // Wrong password (with or without lockout tracking) shows a WARNING.
                    // Account-not-found returns no 'warning' field → shows as error below.
                    const warningMsg = safeStr(body['warning'], '');
                    if (warningMsg) {
                        this.warning.set(warningMsg);
                        this.sound.play('warning');
                    } else {
                        this.error.set(safeStr(body['message'], 'Invalid credentials.'));
                        this.sound.play('error');
                    }
                } else if (status === 429) {
                    this.error.set('Too many attempts. Please wait before trying again.');
                    this.sound.play('error');
                } else {
                    this.error.set(safeStr(body['message'], 'Login failed. Please try again.'));
                    this.sound.play('error');
                }
            },
        });
    }
}
