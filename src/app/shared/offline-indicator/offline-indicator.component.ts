import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkStatusService } from '../../core/services/network-status.service';
import { SyncQueueService } from '../../core/services/sync-queue.service';

@Component({
    selector: 'app-offline-indicator',
    standalone: true,
    imports: [CommonModule],
    template: `
        @if (!network.isOnline()) {
            <div class="offline-toast">
                <i class="bi bi-wifi-off offline-icon"></i>
                <span class="offline-text">
                    You are offline. Changes will sync when connection is restored.
                </span>
                @if (sync.pendingCount() > 0) {
                    <span class="offline-badge">{{ sync.pendingCount() }} pending</span>
                }
            </div>
        }
        @if (sync.failedCount() > 0) {
            <div class="offline-toast failed">
                <i class="bi bi-exclamation-triangle offline-icon"></i>
                <span class="offline-text">
                    {{ sync.failedCount() }} change{{ sync.failedCount() === 1 ? '' : 's' }} couldn't be saved.
                </span>
                <button type="button" class="offline-action" (click)="retry()">Retry</button>
                <button type="button" class="offline-action subtle" (click)="dismiss()">Dismiss</button>
            </div>
        }
    `,
    styles: [`
        :host { display: contents; }

        .offline-toast {
            position: fixed;
            bottom: 1.5rem;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9998;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            // width: calc(100% - 2rem);
            width: max-content;
                // max-width: 560px;
            padding: 0.75rem 1rem;
            background: var(--bg-alt);
            border: 1px solid var(--border);
            color: var(--text-muted);
            font-size: 0.78rem;
            letter-spacing: 0.02em;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            animation: offline-slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .offline-icon {
            flex-shrink: 0;
            font-size: 0.9rem;
        }

        .offline-text {
            flex: 1;
            line-height: 1.45;
        }

        .offline-badge {
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            background: rgba(var(--text-rgb), 0.06);
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 0 0.5rem;
            height: 18px;
            font-size: 0.68rem;
            font-weight: 600;
            letter-spacing: 0.04em;
        }

        .offline-toast.failed {
            border-color: rgba(220, 53, 69, 0.5);
            color: var(--text);
        }

        .offline-toast.failed .offline-icon { color: #dc3545; }

        .offline-action {
            flex-shrink: 0;
            cursor: pointer;
            background: transparent;
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 0.15rem 0.65rem;
            font-size: 0.7rem;
            font-weight: 600;
            letter-spacing: 0.03em;
            color: var(--text);
            transition: background 0.15s ease;
        }

        .offline-action:hover { background: rgba(var(--text-rgb), 0.08); }
        .offline-action.subtle { color: var(--text-muted); border-color: transparent; }

        @keyframes offline-slide-up {
            from { opacity: 0; transform: translateX(-50%) translateY(0.75rem); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `],
})
export class OfflineIndicatorComponent {
    protected readonly network = inject(NetworkStatusService);
    protected readonly sync = inject(SyncQueueService);

    retry() { void this.sync.retryAllFailed(); }
    dismiss() { void this.sync.discardAllFailed(); }
}
