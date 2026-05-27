import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityLogService, ActivityLogEntry } from '../../../core/services/activity-log.service';

@Component({
    selector: 'app-admin-notification-logs',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './admin-notification-logs.component.html',
})
export class AdminNotificationLogsComponent implements OnInit {
    private readonly service = inject(ActivityLogService);
    readonly logs = signal<ActivityLogEntry[]>([]);
    readonly loading = signal(true);
    readonly deleteTargetId = signal<string | null>(null);
    readonly clearConfirm = signal(false);

    readonly resourceIcons: Record<string, string> = {
        blog: 'bi-file-text',
        project: 'bi-folder',
        inquiry: 'bi-envelope',
        feedback: 'bi-star',
        comment: 'bi-chat-left-text',
        invoice: 'bi-receipt',
        push: 'bi-bell',
        client: 'bi-bug',
        system: 'bi-gear',
        auth: 'bi-shield-lock',
        nav: 'bi-map',
    };

    readonly actionLabels: Record<string, string> = {
        'blog:create': 'Blog Created',
        'blog:update': 'Blog Updated',
        'blog:publish': 'Blog Published',
        'blog:unpublish': 'Blog Unpublished',
        'blog:delete': 'Blog Deleted',
        'project:create': 'Project Created',
        'project:update': 'Project Updated',
        'project:unpublish': 'Project Unpublished',
        'project:delete': 'Project Deleted',
        'inquiry:received': 'New Inquiry',
        'inquiry:read': 'Inquiry Read',
        'inquiry:delete': 'Inquiry Deleted',
        'feedback:received': 'New Review',
        'feedback:approve': 'Review Approved',
        'feedback:disapprove': 'Review Disapproved',
        'feedback:delete': 'Review Deleted',
        'comment:received': 'New Comment',
        'comment:approve': 'Comment Approved',
        'comment:unapprove': 'Comment Unapproved',
        'comment:delete': 'Comment Deleted',
        'invoice:create': 'Invoice Created',
        'invoice:update': 'Invoice Updated',
        'invoice:delete': 'Invoice Deleted',
        'push:sent': 'Push Sent',
        'push:skipped': 'Push Skipped',
        'push:error': 'Push Error',
        'error:client': 'Client Error',
        'error:server': 'Server Error',
        'auth:login': 'Login',
        'auth:login-fail': 'Login Failed',
        'auth:account-locked': 'Account Locked',
        'nav:404': '404 Not Found',
    };

    ngOnInit() {
        this.loadLogs();
    }

    private loadLogs() {
        this.loading.set(true);
        this.service.getLogs(300).subscribe({
            next: (data) => { this.logs.set(data); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
    }

    refresh() {
        this.loadLogs();
    }

    confirmDelete(id: string) {
        this.deleteTargetId.set(id);
    }

    cancelDelete() {
        this.deleteTargetId.set(null);
    }

    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.service.remove(id).subscribe({
            next: () => {
                this.logs.update(list => list.filter(l => l.id !== id));
                this.deleteTargetId.set(null);
            },
        });
    }

    confirmClearAll() {
        this.clearConfirm.set(true);
    }

    cancelClearAll() {
        this.clearConfirm.set(false);
    }

    executeClearAll() {
        this.service.clearAll().subscribe({
            next: () => {
                this.logs.set([]);
                this.clearConfirm.set(false);
            },
        });
    }

    getBadgeClass(log: ActivityLogEntry): string {
        if (log.status === 'error') return 'admin-badge--danger';
        const action = log.action;
        if (action === 'auth:login') return 'admin-badge--on';
        if (action.endsWith(':create') || action.endsWith(':received') || action.endsWith(':approve') || action.endsWith(':publish') || action === 'push:sent') {
            return 'admin-badge--on';
        }
        if (action.endsWith(':delete') || action.endsWith(':disapprove') || action.endsWith(':unpublish') || action.endsWith(':unapprove')) {
            return 'admin-badge--warn';
        }
        return '';
    }

    getActionLabel(action: string): string {
        return this.actionLabels[action] ?? action;
    }

    getResourceIcon(resource: string): string {
        return this.resourceIcons[resource] ?? 'bi-circle';
    }
}

