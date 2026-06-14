import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AdminSettingsService, AdminSettings, LoginSession } from '../../../../../core/services/admin-settings.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { RealtimeService } from '../../../../../core/services/realtime.service';

@Component({
    selector: 'app-settings-security',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule],
    templateUrl: './settings-security.component.html',
})
export class SettingsSecurityComponent implements OnInit, OnDestroy {
    private readonly settingsService = inject(AdminSettingsService);
    private readonly auth = inject(AuthService);
    private readonly realtime = inject(RealtimeService);
    private rtSubs = new Subscription();

    // ── Security Settings form ────────────────────────────────────────────────
    readonly settingsLoading = signal(false);
    readonly settingsSaved = signal(false);
    readonly settingsError = signal('');

    enableInactivityLogout = true;
    inactivityTimeoutMinutes = 10;
    enableLoginAttemptSuspend = true;
    maxLoginAttempts = 3;
    lockDurationMinutes = 180;
    rememberMeDays = 30;
    sessionDurationDays = 1;

    // ── Sessions ──────────────────────────────────────────────────────────────
    readonly sessionsLoading = signal(true);
    readonly sessionsError = signal('');
    readonly revokeLoading = signal<string | null>(null);
    readonly revokeConfirmId = signal<string | null>(null);
    readonly revokeAllConfirm = signal(false);
    readonly clearRevokedConfirm = signal(false);
    readonly clearRevokedLoading = signal(false);
    readonly sessionsPage = signal(1);
    readonly sessionsPageSize = 10;

    get pagedSessions(): LoginSession[] {
        const start = (this.sessionsPage() - 1) * this.sessionsPageSize;
        return this.sessions.slice(start, start + this.sessionsPageSize);
    }

    get sessionsTotalPages(): number {
        return Math.max(1, Math.ceil(this.sessions.length / this.sessionsPageSize));
    }

    get sessionsPageNumbers(): number[] {
        const total = this.sessionsTotalPages;
        const cur = this.sessionsPage();
        const pages: number[] = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i);
        return pages;
    }

    // ── Change Password ───────────────────────────────────────────────────────
    readonly pwLoading = signal(false);
    readonly pwSuccess = signal('');
    readonly pwError = signal('');
    readonly showCurrentPw = signal(false);
    readonly showNewPw = signal(false);
    readonly showConfirmPw = signal(false);
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';

    get sessions() { return this.settingsService.sessions(); }
    get currentSessionId() { return this.settingsService.currentSessionId(); }
    get hasRevokedSessions(): boolean { return this.settingsService.sessions().some(s => !s.isActive); }

    ngOnInit() {
        this.settingsService.load();
        this.syncFormFromSettings(this.settingsService.settings());
        if (!this.settingsService.loaded()) {
            const poll = setInterval(() => {
                if (this.settingsService.loaded()) {
                    this.syncFormFromSettings(this.settingsService.settings());
                    clearInterval(poll);
                }
            }, 100);
        }

        this.settingsService.loadSessions().subscribe({
            next: () => this.sessionsLoading.set(false),
            error: () => { this.sessionsLoading.set(false); this.sessionsError.set('Failed to load sessions.'); },
        });

        this.rtSubs.add(this.realtime.on<LoginSession[]>('session:list_updated').subscribe(sessions => {
            this.settingsService.sessions.set(sessions);
        }));
    }

    ngOnDestroy() {
        this.rtSubs.unsubscribe();
    }

    private syncFormFromSettings(s: AdminSettings) {
        this.enableInactivityLogout = s.enableInactivityLogout;
        this.inactivityTimeoutMinutes = s.inactivityTimeoutMinutes;
        this.enableLoginAttemptSuspend = s.enableLoginAttemptSuspend;
        this.maxLoginAttempts = s.maxLoginAttempts;
        this.lockDurationMinutes = s.lockDurationMinutes;
        this.rememberMeDays = s.rememberMeDays;
        this.sessionDurationDays = s.sessionDurationDays;
    }

    saveSecuritySettings() {
        this.settingsLoading.set(true);
        this.settingsSaved.set(false);
        this.settingsError.set('');
        this.settingsService.update({
            enableInactivityLogout: this.enableInactivityLogout,
            inactivityTimeoutMinutes: this.inactivityTimeoutMinutes,
            enableLoginAttemptSuspend: this.enableLoginAttemptSuspend,
            maxLoginAttempts: this.maxLoginAttempts,
            lockDurationMinutes: this.lockDurationMinutes,
            rememberMeDays: this.rememberMeDays,
            sessionDurationDays: this.sessionDurationDays,
        }).subscribe({
            next: () => { this.settingsLoading.set(false); this.settingsSaved.set(true); setTimeout(() => this.settingsSaved.set(false), 3000); },
            error: (e) => { this.settingsLoading.set(false); this.settingsError.set(e?.error?.message ?? 'Failed to save settings.'); },
        });
    }

    revokeSession(id: string) { this.revokeConfirmId.set(id); }
    cancelRevokeSession() { this.revokeConfirmId.set(null); }

    executeRevokeSession() {
        const id = this.revokeConfirmId();
        if (!id) return;
        this.revokeConfirmId.set(null);
        this.revokeLoading.set(id);
        this.settingsService.revokeSession(id).subscribe({
            next: () => this.revokeLoading.set(null),
            error: () => this.revokeLoading.set(null),
        });
    }

    revokeAll() { this.revokeAllConfirm.set(true); }
    cancelRevokeAll() { this.revokeAllConfirm.set(false); }

    executeRevokeAll() {
        this.revokeAllConfirm.set(false);
        this.revokeLoading.set('all');
        this.settingsService.revokeAllSessions().subscribe({
            next: () => this.revokeLoading.set(null),
            error: () => this.revokeLoading.set(null),
        });
    }

    clearRevoked() { this.clearRevokedConfirm.set(true); }
    cancelClearRevoked() { this.clearRevokedConfirm.set(false); }

    executeClearRevoked() {
        this.clearRevokedConfirm.set(false);
        this.clearRevokedLoading.set(true);
        this.settingsService.clearRevokedSessions().subscribe({
            next: () => this.clearRevokedLoading.set(false),
            error: () => this.clearRevokedLoading.set(false),
        });
    }

    changePassword() {
        this.pwError.set('');
        this.pwSuccess.set('');
        if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
            this.pwError.set('All fields are required.');
            return;
        }
        if (this.newPassword.length < 8) {
            this.pwError.set('New password must be at least 8 characters.');
            return;
        }
        if (this.newPassword !== this.confirmPassword) {
            this.pwError.set('Passwords do not match.');
            return;
        }
        this.pwLoading.set(true);
        this.settingsService.changePassword(this.currentPassword, this.newPassword).subscribe({
            next: () => {
                this.pwLoading.set(false);
                this.pwSuccess.set('Password changed. You will be logged out.');
                this.currentPassword = '';
                this.newPassword = '';
                this.confirmPassword = '';
                setTimeout(() => this.auth.logout().subscribe(), 2000);
            },
            error: (e) => {
                this.pwLoading.set(false);
                this.pwError.set(e?.error?.message ?? 'Failed to change password.');
            },
        });
    }

    formatLockDuration(minutes: number): string {
        if (minutes < 60) return `${minutes} min`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
}
