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
    status: 'pending' | 'failed';
}

const MAX_RETRIES = 3;

@Injectable({ providedIn: 'root' })
export class SyncQueueService {
    private readonly http = inject(HttpClient);
    private readonly idb = inject(IdbService);
    private readonly network = inject(NetworkStatusService);

    readonly pendingCount = signal(0);

    async init(): Promise<void> {
        await this.refreshCount();
        this.network.online$.subscribe(() => this.processQueue());
    }

    async enqueue(item: Omit<SyncItem, 'id' | 'retries' | 'status'>): Promise<void> {
        await this.idb.put<SyncItem>('sync_queue', { ...item, retries: 0, status: 'pending' });
        await this.refreshCount();
    }

    async processQueue(): Promise<void> {
        const items = await this.idb.getAll<SyncItem>('sync_queue');
        const pending = items.filter(i => i.status === 'pending' || i.status === 'failed');
        for (const item of pending) {
            if (item.retries >= MAX_RETRIES) {
                await this.idb.delete('sync_queue', item.id!);
                continue;
            }
            try {
                await firstValueFrom(
                    this.http.request(item.method, item.url, { body: item.body }),
                );
                await this.idb.delete('sync_queue', item.id!);
            } catch {
                const updated: SyncItem = { ...item, retries: item.retries + 1, status: 'failed' };
                await this.idb.put('sync_queue', updated);
            }
        }
        await this.refreshCount();
    }

    private async refreshCount(): Promise<void> {
        const items = await this.idb.getAll<SyncItem>('sync_queue');
        this.pendingCount.set(items.filter(i => i.status === 'pending').length);
    }
}
