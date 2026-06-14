import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivityLogService, ActivityLogEntry } from '../../../../../core/services/activity-log.service';
import { RealtimeService } from '../../../../../core/services/realtime.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-insights-activity',
    standalone: true,
    imports: [CommonModule, DatePipe],
    templateUrl: './insights-activity.component.html',
})
export class InsightsActivityComponent implements OnInit, OnDestroy {
    private readonly logService = inject(ActivityLogService);
    private readonly realtime = inject(RealtimeService);
    private rtSubs = new Subscription();

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
        this.loadActivityLogs();
        this.rtSubs.add(this.realtime.on<ActivityLogEntry>('activity:log_created').subscribe(entry => {
            this.activityLogs.update(list => [entry, ...list]);
        }));
    }

    ngOnDestroy() {
        this.rtSubs.unsubscribe();
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
}
