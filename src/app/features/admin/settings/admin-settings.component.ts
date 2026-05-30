import { Component, OnInit, inject, signal, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AdminSettingsService, AdminSettings, AdminProfile, LoginSession } from '../../../core/services/admin-settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { FooterSettingsService } from '../../../core/services/footer-settings.service';
import { RteToolbarComponent } from '../../../shared/components/rte-toolbar/rte-toolbar.component';
import { ActivityLogService, ActivityLogEntry } from '../../../core/services/activity-log.service';
import { PushNotificationAdminService } from '../../../core/services/push-notification-admin.service';
import { FcmService } from '../../../core/services/fcm.service';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { TickerService, TickerMessage } from '../../../core/services/ticker.service';
import { VisitorAnalyticsService, VisitorSession, VisitorStats } from '../../../core/services/visitor-analytics.service';

@Component({
    selector: 'app-admin-settings',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule, RouterLink, RteToolbarComponent, ImgFallbackDirective],
    templateUrl: './admin-settings.component.html',
})
export class AdminSettingsComponent implements OnInit {
    private readonly settingsService = inject(AdminSettingsService);
    private readonly footerService = inject(FooterSettingsService);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly logService = inject(ActivityLogService);
    private readonly pushService = inject(PushNotificationAdminService);
    private readonly titleService = inject(Title);
    readonly fcm = inject(FcmService);
    private readonly tickerService = inject(TickerService);

    @ViewChild('aboutEl') aboutEl!: HTMLTextAreaElement;

    // ── Section tabs — driven by route param ─────────────────────────────────
    readonly activeTab = signal<'profile' | 'security' | 'notifications' | 'ticker' | 'visitors'>('profile');

    // ── Visitors tab ─────────────────────────────────────────────────────────
    private readonly visitorService = inject(VisitorAnalyticsService);
    readonly visitorsLoading = signal(false);
    readonly visitorsLoaded = signal(false);
    readonly visitorStats = signal<VisitorStats | null>(null);
    readonly visitorSessions = signal<VisitorSession[]>([]);
    readonly visitorsTotal = signal(0);
    readonly visitorsPage = signal(1);
    readonly visitorsLimit = signal(25);
    readonly visitorsTotalPages = signal(1);
    readonly visitorsSearch = signal('');

    get visitorsPageNumbers(): number[] {
        const total = this.visitorsTotalPages();
        const cur = this.visitorsPage();
        const pages: number[] = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i);
        return pages;
    }

    // ── Activity Logs (Security tab) ─────────────────────────────────────────
    readonly activityLogs = signal<ActivityLogEntry[]>([]);
    readonly activityLogsLoading = signal(false);
    readonly activityLogsLoaded = signal(false);
    readonly activityPage = signal(1);
    readonly deleteLogTargetId = signal<string | null>(null);
    readonly activityPageSize = 15;

    get pagedActivityLogs(): ActivityLogEntry[] {
        const start = (this.activityPage() - 1) * this.activityPageSize;
        return this.activityLogs().slice(start, start + this.activityPageSize);
    }

    get activityTotalPages(): number {
        return Math.max(1, Math.ceil(this.activityLogs().length / this.activityPageSize));
    }

    // ── Push Notifications (Notifications tab) ────────────────────────────────
    pushTitle = '';
    pushBody = '';
    pushUrl = '';
    readonly pushing = signal(false);
    readonly pushSuccess = signal<string | null>(null);
    readonly pushError = signal<string | null>(null);

    // ── Ticker Messages (Ticker tab) ─────────────────────────────────────────
    readonly tickerItems = signal<TickerMessage[]>([]);
    readonly tickerLoading = signal(false);
    readonly tickerLoaded = signal(false);
    readonly tickerSaving = signal(false);
    readonly tickerError = signal<string | null>(null);
    readonly tickerSuccess = signal<string | null>(null);
    readonly tickerDeleteTargetId = signal<string | null>(null);
    readonly tickerDeleting = signal(false);
    readonly tickerShowForm = signal(false);
    readonly tickerEditing = signal<TickerMessage | null>(null);
    // Pagination
    readonly tickerPage = signal(1);
    readonly tickerLimit = signal(10);
    readonly tickerTotal = signal(0);
    readonly tickerTotalPages = signal(1);
    readonly tickerSearch = signal('');
    // Form fields
    tickerFormMessage = '';
    tickerFormPublished = true;
    tickerFormAutoDeactivateAt = '';

    // ── Profile ──────────────────────────────────────────────────────────────
    readonly profileSaving = signal<'identity' | 'about' | 'links' | null>(null);
    readonly profileSaved = signal<'identity' | 'about' | 'links' | null>(null);
    readonly profileError = signal<{ section: 'identity' | 'about' | 'links'; msg: string } | null>(null);
    readonly avatarUploading = signal(false);
    readonly avatarPreview = signal<string | null>(null);

    profileDisplayName = '';
    profileBio = '';
    profileAboutHtml = '';
    profileTimezone = 'Asia/Karāchi';

    /** All link fields keyed by field name */
    profileLinks: Record<string, string> = {};
    socialVisibility: Record<string, { footer: boolean; contact: boolean }> = {};

    readonly SOCIAL_FIELDS: { key: string; label: string; icon: string; hasFooter: boolean; type?: string; placeholder: string }[] = [
        { key: 'contactEmail', label: 'Email', icon: 'bi-envelope', hasFooter: true, type: 'email', placeholder: 'contact@example.com' },
        { key: 'phone', label: 'Phone', icon: 'bi-telephone', hasFooter: false, type: 'tel', placeholder: '+1 555 000 0000' },
        { key: 'location', label: 'Based in', icon: 'bi-geo-alt', hasFooter: false, placeholder: 'Karāchi, Pakistan' },
        { key: 'website', label: 'Website', icon: 'bi-globe2', hasFooter: true, type: 'url', placeholder: 'https://yoursite.com' },
        { key: 'github', label: 'GitHub', icon: 'bi-github', hasFooter: true, placeholder: 'username or full URL' },
        { key: 'linkedin', label: 'LinkedIn', icon: 'bi-linkedin', hasFooter: true, placeholder: 'username or full URL' },
        { key: 'twitter', label: 'X / Twitter', icon: 'bi-twitter-x', hasFooter: true, placeholder: 'username or full URL' },
        { key: 'instagram', label: 'Instagram', icon: 'bi-instagram', hasFooter: true, placeholder: 'username or full URL' },
        { key: 'youtube', label: 'YouTube', icon: 'bi-youtube', hasFooter: true, placeholder: 'channel URL or handle' },
        { key: 'discord', label: 'Discord', icon: 'bi-discord', hasFooter: true, placeholder: 'invite link or server URL' },
        { key: 'stackoverflow', label: 'Stack Overflow', icon: 'bi-stack-overflow', hasFooter: true, placeholder: 'profile URL' },
        { key: 'medium', label: 'Medium', icon: 'bi-medium', hasFooter: true, placeholder: 'profile URL or @handle' },
        { key: 'dribbble', label: 'Dribbble', icon: 'bi-dribbble', hasFooter: true, placeholder: 'profile URL' },
    ];

    getSocialVis(key: string, place: 'footer' | 'contact'): boolean {
        return this.socialVisibility[key]?.[place] !== false;
    }

    setSocialVis(key: string, place: 'footer' | 'contact', val: boolean) {
        const cur = this.socialVisibility[key] ?? { footer: true, contact: true };
        this.socialVisibility = { ...this.socialVisibility, [key]: { ...cur, [place]: val } };
    }

    readonly TIMEZONES = [
        'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Karāchi',
        'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo',
        'Australia/Sydney', 'Pacific/Auckland',
    ];

    // ── Footer Branding ───────────────────────────────────────────────────────
    readonly footerSaved = signal(false);
    readonly footerError = signal('');
    readonly footerLoading = signal(false);

    footerCopyrightOwner = 'mhfrough.dev';
    footerTagline = 'Made with \u2665 in Karāchi';
    footerShowTagline = true;

    readonly year = new Date().getFullYear();

    // ── Settings form ─────────────────────────────────────────────────────────
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

    // ── Sessions ─────────────────────────────────────────────────────────────
    readonly sessionsLoading = signal(true);
    readonly sessionsError = signal('');
    readonly revokeLoading = signal<string | null>(null);
    readonly revokeConfirmId = signal<string | null>(null);
    readonly revokeAllConfirm = signal(false);

    // ── Change Password ──────────────────────────────────────────────────────
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
    get settings() { return this.settingsService.settings(); }

    ngOnInit() {
        // Read :tab param from route and keep in sync
        this.route.paramMap.subscribe(params => {
            const tab = params.get('tab') as 'profile' | 'security' | 'notifications' | 'ticker' | 'visitors';
            if (tab && ['profile', 'security', 'notifications', 'ticker', 'visitors'].includes(tab)) {
                this.activeTab.set(tab);
                const tabLabels: Record<string, string> = {
                    profile: 'Profile Settings',
                    security: 'Security Settings',
                    notifications: 'Notification Settings',
                    ticker: 'Ticker Settings',
                    visitors: 'Visitor Analytics',
                };
                this.titleService.setTitle(`${tabLabels[tab] ?? 'Settings'} | Admin`);
                if (tab === 'security' && !this.activityLogsLoaded()) {
                    this.loadActivityLogs();
                }
                if (tab === 'ticker' && !this.tickerLoaded()) {
                    this.loadTickers();
                }
                if (tab === 'visitors' && !this.visitorsLoaded()) {
                    this.loadVisitors();
                }
            }
        });

        // Load settings
        this.settingsService.load();
        const s = this.settingsService.settings();
        this.syncFormFromSettings(s);
        if (!this.settingsService.loaded()) {
            const sub = setInterval(() => {
                if (this.settingsService.loaded()) {
                    this.syncFormFromSettings(this.settingsService.settings());
                    clearInterval(sub);
                }
            }, 100);
        }

        // Load sessions
        this.settingsService.loadSessions().subscribe({
            next: () => this.sessionsLoading.set(false),
            error: () => { this.sessionsLoading.set(false); this.sessionsError.set('Failed to load sessions.'); },
        });

        // Load profile
        this.settingsService.loadProfile().subscribe({
            next: (p) => this.syncFormFromProfile(p),
            error: () => { },
        });
    }

    private syncFormFromSettings(s: AdminSettings) {
        this.enableInactivityLogout = s.enableInactivityLogout;
        this.inactivityTimeoutMinutes = s.inactivityTimeoutMinutes;
        this.enableLoginAttemptSuspend = s.enableLoginAttemptSuspend;
        this.maxLoginAttempts = s.maxLoginAttempts;
        this.lockDurationMinutes = s.lockDurationMinutes;
        this.rememberMeDays = s.rememberMeDays;
        this.sessionDurationDays = s.sessionDurationDays;
        this.footerCopyrightOwner = s.copyrightOwner ?? 'mhfrough.dev';
        this.footerTagline = s.footerTagline ?? 'Made with \u2665 in Karāchi';
        this.footerShowTagline = s.showFooterTagline ?? true;
    }

    private syncFormFromProfile(p: AdminProfile) {
        this.profileDisplayName = p.displayName ?? '';
        this.profileBio = p.bio ?? '';
        this.profileAboutHtml = p.aboutHtml ?? '';
        this.profileTimezone = p.timezone ?? 'Asia/Karāchi';
        this.profileLinks = {
            contactEmail: p.contactEmail ?? '',
            phone: p.phone ?? '',
            location: p.location ?? '',
            website: p.website ?? '',
            github: p.github ?? '',
            linkedin: p.linkedin ?? '',
            twitter: p.twitter ?? '',
            instagram: p.instagram ?? '',
            youtube: p.youtube ?? '',
            discord: p.discord ?? '',
            stackoverflow: p.stackoverflow ?? '',
            medium: p.medium ?? '',
            dribbble: p.dribbble ?? '',
        };
        this.socialVisibility = p.socialVisibility ?? {};
        if (p.avatarUrl) this.avatarPreview.set(p.avatarUrl);
    }

    // ── Profile actions ───────────────────────────────────────────────────────

    onAvatarSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        // Preview
        const reader = new FileReader();
        reader.onload = (e) => this.avatarPreview.set(e.target?.result as string);
        reader.readAsDataURL(file);
        // Upload immediately
        this.avatarUploading.set(true);
        this.settingsService.uploadAvatar(file).subscribe({
            next: (res) => {
                this.avatarUploading.set(false);
                this.avatarPreview.set(res.url);
                // Persist the URL to profile right away
                this.settingsService.updateProfile({ avatarUrl: res.url }).subscribe();
            },
            error: () => {
                this.avatarUploading.set(false);
                this.profileError.set({ section: 'identity', msg: 'Avatar upload failed. Please try again.' });
            },
        });
        input.value = '';
    }

    saveProfile(section: 'identity' | 'about' | 'links') {
        this.profileSaving.set(section);
        this.profileSaved.set(null);
        this.profileError.set(null);
        this.settingsService.updateProfile({
            displayName: this.profileDisplayName || undefined,
            bio: this.profileBio || undefined,
            aboutHtml: this.profileAboutHtml || undefined,
            timezone: this.profileTimezone || undefined,
            contactEmail: this.profileLinks['contactEmail'] || undefined,
            phone: this.profileLinks['phone'] || undefined,
            location: this.profileLinks['location'] || undefined,
            website: this.profileLinks['website'] || undefined,
            github: this.profileLinks['github'] || undefined,
            linkedin: this.profileLinks['linkedin'] || undefined,
            twitter: this.profileLinks['twitter'] || undefined,
            instagram: this.profileLinks['instagram'] || undefined,
            youtube: this.profileLinks['youtube'] || undefined,
            discord: this.profileLinks['discord'] || undefined,
            stackoverflow: this.profileLinks['stackoverflow'] || undefined,
            medium: this.profileLinks['medium'] || undefined,
            dribbble: this.profileLinks['dribbble'] || undefined,
            socialVisibility: this.socialVisibility,
        }).subscribe({
            next: () => {
                this.profileSaving.set(null);
                this.profileSaved.set(section);
                // Refresh footer data so live site picks it up
                this.footerService.load();
                setTimeout(() => this.profileSaved.set(null), 3000);
            },
            error: (e) => { this.profileSaving.set(null); this.profileError.set({ section, msg: e?.error?.message ?? 'Failed to save profile.' }); },
        });
    }

    saveFooterBranding() {
        this.footerLoading.set(true);
        this.footerSaved.set(false);
        this.footerError.set('');
        this.settingsService.update({
            copyrightOwner: this.footerCopyrightOwner,
            footerTagline: this.footerTagline,
            showFooterTagline: this.footerShowTagline,
        }).subscribe({
            next: () => {
                this.footerLoading.set(false);
                this.footerSaved.set(true);
                this.footerService.load();
                setTimeout(() => this.footerSaved.set(false), 3000);
            },
            error: (e) => { this.footerLoading.set(false); this.footerError.set(e?.error?.message ?? 'Failed to save footer settings.'); },
        });
    }

    // ── Security actions ───────────────────────────────────────────────────────

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

    revokeSession(id: string) {
        this.revokeConfirmId.set(id);
    }

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

    cancelRevokeSession() { this.revokeConfirmId.set(null); }

    revokeAll() {
        this.revokeAllConfirm.set(true);
    }

    executeRevokeAll() {
        this.revokeAllConfirm.set(false);
        this.revokeLoading.set('all');
        this.settingsService.revokeAllSessions().subscribe({
            next: () => { this.revokeLoading.set(null); },
            error: () => this.revokeLoading.set(null),
        });
    }

    cancelRevokeAll() { this.revokeAllConfirm.set(false); }

    readonly clearRevokedConfirm = signal(false);
    readonly clearRevokedLoading = signal(false);

    clearRevoked() { this.clearRevokedConfirm.set(true); }

    executeClearRevoked() {
        this.clearRevokedConfirm.set(false);
        this.clearRevokedLoading.set(true);
        this.settingsService.clearRevokedSessions().subscribe({
            next: () => this.clearRevokedLoading.set(false),
            error: () => this.clearRevokedLoading.set(false),
        });
    }

    cancelClearRevoked() { this.clearRevokedConfirm.set(false); }

    get hasRevokedSessions(): boolean {
        return this.settingsService.sessions().some(s => !s.isActive);
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

    get profileInitials(): string {
        const name = this.profileDisplayName || this.settingsService.profile()?.email || 'A';
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    }

    // ── Activity Log actions ──────────────────────────────────────────────────

    loadActivityLogs() {
        this.activityLogsLoading.set(true);
        this.activityPage.set(1);
        this.logService.getLogs(300).subscribe({
            next: (data) => {
                this.activityLogs.set(data);
                this.activityLogsLoading.set(false);
                this.activityLogsLoaded.set(true);
            },
            error: () => this.activityLogsLoading.set(false),
        });
    }

    confirmDeleteLog(id: string) { this.deleteLogTargetId.set(id); }
    cancelDeleteLog() { this.deleteLogTargetId.set(null); }

    readonly clearAllLogsConfirm = signal(false);
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

    // ── Push Notification actions ─────────────────────────────────────────────

    requestPushPermission() {
        this.fcm.requestPermissionAndRegister().then((granted) => {
            if (!granted) this.pushError.set('Permission denied or token registration failed.');
            else {
                this.pushSuccess.set('Push notifications enabled for this browser!');
                setTimeout(() => this.pushSuccess.set(null), 4000);
            }
        });
    }

    sendPush(f: NgForm) {
        f.form.markAllAsTouched();
        if (f.invalid) return;
        this.pushing.set(true);
        this.pushSuccess.set(null);
        this.pushError.set(null);
        this.pushService.send({ title: this.pushTitle, body: this.pushBody, url: this.pushUrl || undefined }).subscribe({
            next: () => {
                this.pushing.set(false);
                this.pushSuccess.set('Push notification sent to all subscribers.');
                this.pushTitle = '';
                this.pushBody = '';
                this.pushUrl = '';
            },
            error: (err: any) => {
                this.pushing.set(false);
                this.pushError.set(err?.error?.message ?? 'Failed to send notification.');
            },
        });
    }

    // ── Ticker actions ────────────────────────────────────────────────────────

    loadTickers() {
        this.tickerLoading.set(true);
        this.tickerService.getAll(this.tickerPage(), this.tickerLimit(), this.tickerSearch() || undefined).subscribe({
            next: (res) => {
                this.tickerItems.set(res.data);
                this.tickerTotal.set(res.total);
                this.tickerTotalPages.set(res.totalPages);
                this.tickerLoading.set(false);
                this.tickerLoaded.set(true);
            },
            error: () => {
                this.tickerLoading.set(false);
                this.tickerError.set('Failed to load ticker messages.');
            },
        });
    }

    onTickerSearch(e: Event) {
        this.tickerSearch.set((e.target as HTMLInputElement).value);
        this.tickerPage.set(1);
        this.loadTickers();
    }

    onTickerPageSizeChange(e: Event) {
        this.tickerLimit.set(+(e.target as HTMLSelectElement).value);
        this.tickerPage.set(1);
        this.loadTickers();
    }

    tickerGoToPage(page: number) {
        this.tickerPage.set(page);
        this.loadTickers();
    }

    get tickerPageNumbers(): number[] {
        const total = this.tickerTotalPages();
        const cur = this.tickerPage();
        const pages: number[] = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) {
            pages.push(i);
        }
        return pages;
    }

    openNewTicker() {
        this.tickerEditing.set(null);
        this.tickerFormMessage = '';
        this.tickerFormPublished = true;
        this.tickerFormAutoDeactivateAt = '';
        this.tickerError.set(null);
        this.tickerShowForm.set(true);
    }

    editTicker(item: TickerMessage) {
        this.tickerEditing.set({ ...item });
        this.tickerFormMessage = item.message;
        this.tickerFormPublished = item.isPublished;
        this.tickerFormAutoDeactivateAt = item.autoDeactivateAt
            ? new Date(item.autoDeactivateAt).toISOString().slice(0, 16)
            : '';
        this.tickerError.set(null);
        this.tickerShowForm.set(true);
    }

    cancelTickerForm() {
        this.tickerShowForm.set(false);
        this.tickerEditing.set(null);
    }

    saveTicker(f: NgForm) {
        f.form.markAllAsTouched();
        if (f.invalid || !this.tickerFormMessage.trim()) return;
        this.tickerSaving.set(true);
        this.tickerError.set(null);
        const editing = this.tickerEditing();
        const autoDeactivateAt = this.tickerFormAutoDeactivateAt
            ? new Date(this.tickerFormAutoDeactivateAt).toISOString()
            : null;
        const action$ = editing
            ? this.tickerService.update(editing.id, { message: this.tickerFormMessage.trim(), isPublished: this.tickerFormPublished, autoDeactivateAt: autoDeactivateAt ?? undefined })
            : this.tickerService.create({ message: this.tickerFormMessage.trim(), isPublished: this.tickerFormPublished, autoDeactivateAt });

        action$.subscribe({
            next: () => {
                this.tickerSaving.set(false);
                this.tickerShowForm.set(false);
                this.tickerEditing.set(null);
                this.tickerSuccess.set(editing ? 'Ticker updated.' : 'Ticker created.');
                setTimeout(() => this.tickerSuccess.set(null), 3000);
                this.loadTickers();
            },
            error: (err: any) => {
                this.tickerSaving.set(false);
                this.tickerError.set(err?.error?.message ?? 'Failed to save ticker.');
            },
        });
    }

    toggleTickerPublish(item: TickerMessage) {
        this.tickerService.update(item.id, { isPublished: !item.isPublished }).subscribe({
            next: () => this.loadTickers(),
            error: (err: any) => this.tickerError.set(err?.error?.message ?? 'Failed to update status.'),
        });
    }

    confirmDeleteTicker(id: string) { this.tickerDeleteTargetId.set(id); }
    cancelDeleteTicker() { this.tickerDeleteTargetId.set(null); }

    executeDeleteTicker() {
        const id = this.tickerDeleteTargetId();
        if (!id) return;
        this.tickerDeleting.set(true);
        this.tickerService.remove(id).subscribe({
            next: () => {
                this.tickerDeleteTargetId.set(null);
                this.tickerDeleting.set(false);
                this.tickerSuccess.set('Ticker deleted.');
                setTimeout(() => this.tickerSuccess.set(null), 3000);
                // If deleting last item on page, go to prev page
                if (this.tickerItems().length === 1 && this.tickerPage() > 1) {
                    this.tickerPage.update(p => p - 1);
                }
                this.loadTickers();
            },
            error: (err: any) => {
                this.tickerDeleting.set(false);
                this.tickerDeleteTargetId.set(null);
                this.tickerError.set(err?.error?.message ?? 'Failed to delete ticker.');
            },
        });
    }

    // ── Visitors tab ──────────────────────────────────────────────────────────

    loadVisitors() {
        this.visitorsLoading.set(true);
        this.visitorService.loadStats().subscribe({
            next: (s) => { this.visitorStats.set(s); },
            error: () => { },
        });
        this.fetchVisitorPage();
    }

    private fetchVisitorPage() {
        this.visitorsLoading.set(true);
        this.visitorService.list(this.visitorsPage(), this.visitorsLimit(), this.visitorsSearch() || undefined).subscribe({
            next: (res) => {
                this.visitorSessions.set(res.data);
                this.visitorsTotal.set(res.total);
                this.visitorsTotalPages.set(res.totalPages);
                this.visitorsLoading.set(false);
                this.visitorsLoaded.set(true);
            },
            error: () => this.visitorsLoading.set(false),
        });
    }

    onVisitorsSearch(e: Event) {
        this.visitorsSearch.set((e.target as HTMLInputElement).value);
        this.visitorsPage.set(1);
        this.fetchVisitorPage();
    }

    onVisitorsPageSizeChange(e: Event) {
        this.visitorsLimit.set(+(e.target as HTMLSelectElement).value);
        this.visitorsPage.set(1);
        this.fetchVisitorPage();
    }

    visitorsGoToPage(page: number) {
        this.visitorsPage.set(page);
        this.fetchVisitorPage();
    }

    formatDuration(ms: number): string {
        if (!ms || ms < 1000) return '< 1s';
        const s = Math.floor(ms / 1000);
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        const rem = s % 60;
        return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
    }

    visitorDeviceIcon(type: string | null): string {
        switch (type) {
            case 'mobile': return 'bi-phone';
            case 'tablet': return 'bi-tablet';
            default: return 'bi-display';
        }
    }
}


