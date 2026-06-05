import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AdminSettingsService, AdminSettings, LoginSession } from '../../../../../core/services/admin-settings.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ActivityLogService, ActivityLogEntry } from '../../../../../core/services/activity-log.service';
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
    private readonly logService = inject(ActivityLogService);
    private readonly realtime = inject(RealtimeService);
    private rtSubs = new Subscription();

    // ── Activity Logs ─────────────────────────────────────────────────────────
    readonly activityLogs = signal<ActivityLogEntry[]>([]);
    readonly activityLogsLoading = signal(false);
    readonly activityPage = signal(1);
    readonly deleteLogTargetId = signal<string | null>(null);
    readonly clearAllLogsConfirm = signal(false);
    readonly activityPageSize = 15;

    get pagedActivityLogs(): ActivityLogEntry[] {
        const start = (this.activityPage() - 1) * this.activityPageSize;
        return this.activityLogs().slice(start, start + this.activityPageSize);
    }

    get activityTotalPages(): number {
        return Math.max(1, Math.ceil(this.activityLogs().length / this.activityPageSize));
    }

    get activityPageNumbers(): number[] {
        const total = this.activityTotalPages;
        const cur = this.activityPage();
        const pages: number[] = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i);
        return pages;
    }

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

    // ── AI Chat Auto-Reply ────────────────────────────────────────────────────
    readonly aiSaving = signal(false);
    readonly aiSaved = signal(false);
    readonly aiError = signal('');

    aiEnabled = false;
    aiApiKey = '';
    aiTone = 'professional';
    aiInstruction = '';
    aiAutoReplyDelay = 1500;
    aiMaxResponseLength = 300;

    readonly AI_TONES = [
        { value: 'professional', label: 'Professional' },
        { value: 'friendly', label: 'Friendly' },
        { value: 'casual', label: 'Casual' },
        { value: 'technical', label: 'Technical' },
    ];

    saveAiSettings(): void {
        this.aiSaving.set(true);
        this.aiSaved.set(false);
        this.aiError.set('');

        const payload: Partial<AdminSettings> = {
            aiEnabled: this.aiEnabled,
            aiTone: this.aiTone,
            aiInstruction: this.aiInstruction || undefined,
            aiAutoReplyDelay: this.aiAutoReplyDelay,
            aiMaxResponseLength: this.aiMaxResponseLength,
        };
        const resolvedKey = this.resolveKey(this.aiApiKey);
        if (resolvedKey !== undefined) payload['geminiApiKey'] = resolvedKey;

        this.settingsService.update(payload).subscribe({
            next: () => {
                this.aiSaving.set(false);
                this.aiSaved.set(true);
                setTimeout(() => this.aiSaved.set(false), 3000);
            },
            error: (e: any) => {
                this.aiSaving.set(false);
                this.aiError.set(e?.error?.message ?? 'Failed to save AI settings.');
            },
        });
    }

    private resolveKey(val: string): string | undefined {
        return val && !val.startsWith('••') ? val : undefined;
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

    readonly logResourceIcons: Record<string, string> = {
        blog: 'bi-file-text', project: 'bi-folder', inquiry: 'bi-envelope', feedback: 'bi-star',
        comment: 'bi-chat-left-text', invoice: 'bi-receipt', push: 'bi-bell', client: 'bi-bug',
        system: 'bi-gear', auth: 'bi-shield-lock', nav: 'bi-map',
    };

    readonly logActionLabels: Record<string, string> = {
        'blog:create': 'Blog Created', 'blog:update': 'Blog Updated', 'blog:publish': 'Blog Published',
        'blog:unpublish': 'Blog Unpublished', 'blog:delete': 'Blog Deleted',
        'project:create': 'Project Created', 'project:update': 'Project Updated',
        'project:unpublish': 'Project Unpublished', 'project:delete': 'Project Deleted',
        'inquiry:received': 'New Inquiry', 'inquiry:read': 'Inquiry Read', 'inquiry:delete': 'Inquiry Deleted',
        'feedback:received': 'New Review', 'feedback:approve': 'Review Approved',
        'feedback:disapprove': 'Review Disapproved', 'feedback:delete': 'Review Deleted',
        'comment:received': 'New Comment', 'comment:approve': 'Comment Approved',
        'comment:unapprove': 'Comment Unapproved', 'comment:delete': 'Comment Deleted',
        'invoice:create': 'Invoice Created', 'invoice:update': 'Invoice Updated', 'invoice:delete': 'Invoice Deleted',
        'push:sent': 'Push Sent', 'push:skipped': 'Push Skipped', 'push:error': 'Push Error',
        'error:client': 'Client Error', 'error:server': 'Server Error',
        'auth:login': 'Login', 'auth:login-fail': 'Login Failed',
        'auth:account-locked': 'Account Locked', 'nav:404': '404 Not Found',
    };

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

        this.loadActivityLogs();

        this.rtSubs.add(this.realtime.on<ActivityLogEntry>('activity:log_created').subscribe(entry => {
            this.activityLogs.update(list => [entry, ...list]);
        }));

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
        // AI
        this.aiEnabled = s.aiEnabled ?? false;
        this.aiApiKey = s.geminiApiKey ? '••••••••' : '';
        this.aiTone = s.aiTone ?? 'professional';
        this.aiInstruction = s.aiInstruction ?? '';
        this.aiAutoReplyDelay = s.aiAutoReplyDelay ?? 1500;
        this.aiMaxResponseLength = s.aiMaxResponseLength ?? 300;
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

    loadActivityLogs() {
        this.activityLogsLoading.set(true);
        this.activityPage.set(1);
        this.logService.getLogs(300).subscribe({
            next: (data) => { this.activityLogs.set(data); this.activityLogsLoading.set(false); },
            error: () => this.activityLogsLoading.set(false),
        });
    }

    confirmDeleteLog(id: string) { this.deleteLogTargetId.set(id); }
    cancelDeleteLog() { this.deleteLogTargetId.set(null); }

    executeDeleteLog() {
        const id = this.deleteLogTargetId();
        if (!id) return;
        this.logService.remove(id).subscribe({
            next: () => {
                this.activityLogs.update(list => list.filter(l => l.id !== id));
                this.deleteLogTargetId.set(null);
            },
        });
    }

    confirmClearAllLogs() { this.clearAllLogsConfirm.set(true); }
    cancelClearAllLogs() { this.clearAllLogsConfirm.set(false); }

    executeClearAllLogs() {
        this.logService.clearAll().subscribe({
            next: () => {
                this.activityLogs.set([]);
                this.activityPage.set(1);
                this.clearAllLogsConfirm.set(false);
            },
        });
    }

    getLogBadgeClass(log: ActivityLogEntry): string {
        if (log.status === 'error') return 'admin-badge--danger';
        const action = log.action;
        if (action === 'push:skipped') return 'admin-badge--danger';
        if (action === 'auth:login') return 'admin-badge--on';
        if (action.endsWith(':create') || action.endsWith(':received') || action.endsWith(':approve')
            || action.endsWith(':publish') || action === 'push:sent') return 'admin-badge--on';
        if (action.endsWith(':delete') || action.endsWith(':disapprove')
            || action.endsWith(':unpublish') || action.endsWith(':unapprove')) return 'admin-badge--warn';
        return '';
    }

    getLogActionLabel(action: string): string { return this.logActionLabels[action] ?? action; }
    getLogResourceIcon(resource: string): string { return this.logResourceIcons[resource] ?? 'bi-circle'; }

    formatLockDuration(minutes: number): string {
        if (minutes < 60) return `${minutes} min`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
}
