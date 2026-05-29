import { Component, inject, signal, HostBinding, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SoundService } from '../../../core/services/sound.service';

@Component({
    selector: 'app-admin-login',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule, RouterLink],
    templateUrl: './admin-login.component.html',
})
export class AdminLoginComponent implements OnDestroy {
    @HostBinding('attr.data-bs-theme') readonly darkTheme = 'dark';
    private auth = inject(AuthService);
    private router = inject(Router);
    private sound = inject(SoundService);
    readonly loading = signal(false);
    readonly error = signal('');
    readonly warning = signal('');
    readonly lockInfo = signal<{ lockedUntil: Date; remainingSeconds: number } | null>(null);
    readonly showPassword = signal(false);
    readonly rememberMe = signal(false);

    private lockTimer: ReturnType<typeof setInterval> | null = null;

    ngOnDestroy(): void {
        this.clearTimer();
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
        this.loading.set(true);
        this.error.set('');
        this.warning.set('');
        this.lockInfo.set(null);
        this.auth.login(form.value.email, form.value.password, this.rememberMe()).subscribe({
            next: () => this.router.navigate(['/admin']),
            error: (err) => {
                this.loading.set(false);
                const raw = err?.error;
                let body: Record<string, unknown> = {};
                if (raw && typeof raw === 'object') {
                    body = raw;
                } else if (typeof raw === 'string') {
                    try { body = JSON.parse(raw); } catch { /* non-JSON */ }
                }
                const status = err?.status;

                if (body['error'] === 'account_locked' || status === 423) {
                    const lockedUntil = body['lockedUntil']
                        ? new Date(body['lockedUntil'] as string)
                        : new Date(Date.now() + ((body['remainingMinutes'] as number) ?? 180) * 60 * 1000);
                    this.lockInfo.set({ lockedUntil, remainingSeconds: 0 });
                    this.startCountdown(lockedUntil);
                    this.sound.play('error');
                } else if (body['error'] === 'invalid_credentials' || (status === 401 && body['attemptsLeft'] !== undefined)) {
                    this.warning.set((body['warning'] as string) ?? 'Wrong password.');
                    this.sound.play('notification');
                } else if (status === 429) {
                    this.error.set('Too many attempts. Please wait before trying again.');
                    this.sound.play('error');
                } else {
                    this.error.set((body['message'] as string) ?? 'Login failed. Please try again.');
                    this.sound.play('error');
                }
            },
        });
    }
}
