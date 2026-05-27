import { Component, inject, signal, HostBinding, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

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
                const body = err?.error ?? {};
                const status = err?.status;

                if (body.error === 'account_locked' || status === 423) {
                    const lockedUntil = body.lockedUntil
                        ? new Date(body.lockedUntil)
                        : new Date(Date.now() + (body.remainingMinutes ?? 180) * 60 * 1000);
                    this.lockInfo.set({ lockedUntil, remainingSeconds: 0 });
                    this.startCountdown(lockedUntil);
                } else if (body.error === 'invalid_credentials' || (status === 401 && body.attemptsLeft !== undefined)) {
                    this.warning.set(body.warning ?? 'Wrong password.');
                } else if (status === 429) {
                    this.error.set('Too many attempts. Please wait before trying again.');
                } else {
                    this.error.set(body.message ?? 'Login failed. Please try again.');
                }
            },
        });
    }
}
