import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IdbService } from './idb.service';
import { NetworkStatusService } from './network-status.service';

export interface SyncItem {
    id?: number;
    url: string;
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body: unknown;
    timestamp: number;
    retries: number;
    /** `pending` is auto-retried; `failed` exhausted its retries and needs a manual decision. */
    status: 'pending' | 'failed';
}

const MAX_RETRIES = 3;

@Injectable({ providedIn: 'root' })
export class SyncQueueService {
    private readonly http = inject(HttpClient);
    private readonly idb = inject(IdbService);
    private readonly network = inject(NetworkStatusService);

    /** Writes still waiting to be sent (auto-retried when online). */
    readonly pendingCount = signal(0);
    /** Writes that exhausted their retries — surfaced for manual retry/discard. */
    readonly failedCount = signal(0);

    /** Guards against overlapping runs (e.g. rapid online/offline toggling). */
    private processing = false;

    async init(): Promise<void> {
        await this.refreshCounts();
        this.network.online$.subscribe(() => this.processQueue());
    }

    async enqueue(item: Omit<SyncItem, 'id' | 'retries' | 'status'>): Promise<void> {
        await this.idb.put<SyncItem>('sync_queue', { ...item, retries: 0, status: 'pending' });
        await this.refreshCounts();
        // Flush right away if we happen to be online (e.g. an optimistic write).
        if (this.network.isOnline()) void this.processQueue();
    }

    async processQueue(): Promise<void> {
        if (this.processing || !this.network.isOnline()) return;
        this.processing = true;
        try {
            const items = await this.idb.getAll<SyncItem>('sync_queue');
            const pending = items.filter(i => i.status === 'pending');
            for (const item of pending) {
                try {
                    await firstValueFrom(
                        this.http.request(item.method, item.url, { body: item.body }),
                    );
                    await this.idb.delete('sync_queue', item.id!);
                } catch {
                    const retries = item.retries + 1;
                    // Keep exhausted items as `failed` rather than deleting them,
                    // so a write is never silently lost.
                    const updated: SyncItem = {
                        ...item,
                        retries,
                        status: retries >= MAX_RETRIES ? 'failed' : 'pending',
                    };
                    await this.idb.put('sync_queue', updated);
                }
            }
        } finally {
            this.processing = false;
            await this.refreshCounts();
        }
    }

    /** Items that permanently failed and need a manual decision. */
    getFailed(): Promise<SyncItem[]> {
        return this.idb
            .getAll<SyncItem>('sync_queue')
            .then(items => items.filter(i => i.status === 'failed'));
    }

    /** Re-queue every failed item for another round of automatic retries. */
    async retryAllFailed(): Promise<void> {
        const failed = await this.getFailed();
        await Promise.all(
            failed.map(i => this.idb.put<SyncItem>('sync_queue', { ...i, retries: 0, status: 'pending' })),
        );
        await this.refreshCounts();
        void this.processQueue();
    }

    /** Permanently drop a single failed item. */
    async discard(id: number): Promise<void> {
        await this.idb.delete('sync_queue', id);
        await this.refreshCounts();
    }

    /** Permanently drop all failed items. */
    async discardAllFailed(): Promise<void> {
        const failed = await this.getFailed();
        await Promise.all(failed.map(i => this.idb.delete('sync_queue', i.id!)));
        await this.refreshCounts();
    }

    private async refreshCounts(): Promise<void> {
        const items = await this.idb.getAll<SyncItem>('sync_queue');
        this.pendingCount.set(items.filter(i => i.status === 'pending').length);
        this.failedCount.set(items.filter(i => i.status === 'failed').length);
    }
}
