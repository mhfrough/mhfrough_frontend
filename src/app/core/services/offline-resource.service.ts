import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { IdbService, IdbStoreName } from './idb.service';
import { NetworkStatusService } from './network-status.service';
import { SyncQueueService } from './sync-queue.service';

export type Mutation = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Paginated<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/**
 * Shared base for content services (blogs/projects/gallery) that need
 * offline-first reads and write-queueing. Centralises the IDB
 * stale-while-revalidate read pattern and the "send now, or queue while
 * offline" write pattern that were previously copy-pasted across each service.
 */
export abstract class OfflineResourceService {
    protected readonly http = inject(HttpClient);
    protected readonly idb = inject(IdbService);
    protected readonly network = inject(NetworkStatusService);
    protected readonly syncQueue = inject(SyncQueueService);

    /** Queue a write to be replayed when connectivity returns. */
    protected enqueue(method: Mutation, url: string, body: unknown = null): Observable<{ queued: true }> {
        return from(
            this.syncQueue
                .enqueue({ url, method, body, timestamp: Date.now() })
                .then(() => ({ queued: true as const })),
        );
    }

    /**
     * Perform a mutation immediately when online, otherwise queue it.
     * Generic defaults to `any` so callers can use the result loosely, matching
     * the previous per-service helpers.
     */
    protected mutate<T = any>(method: Mutation, url: string, body: unknown = null): Observable<T | { queued: true }> {
        if (!this.network.isOnline()) return this.enqueue(method, url, body);
        return this.http.request<T>(method, url, { body });
    }

    /**
     * Stale-while-revalidate for a paginated list: when `cacheable` (typically
     * page 1 with no filters), emits the cached items immediately, then fetches
     * fresh data, refreshes the cache, and emits that. Non-cacheable requests
     * (filtered/other pages) just pass through to the network.
     */
    protected staleList<T>(opts: {
        store: IdbStoreName;
        cacheable: boolean;
        limit: number;
        fetch: () => Observable<Paginated<T>>;
    }): Observable<Paginated<T>> {
        return new Observable<Paginated<T>>(subscriber => {
            if (opts.cacheable) {
                this.idb.getAll<T>(opts.store).then(cached => {
                    if (cached.length) {
                        subscriber.next({
                            data: cached.slice(0, opts.limit),
                            total: cached.length,
                            page: 1,
                            limit: opts.limit,
                            totalPages: Math.ceil(cached.length / opts.limit),
                        });
                    }
                });
            }
            opts.fetch().subscribe({
                next: fresh => {
                    if (opts.cacheable) this.idb.putMany(opts.store, fresh.data).catch(() => {});
                    subscriber.next(fresh);
                    subscriber.complete();
                },
                error: err => subscriber.error(err),
            });
        });
    }

    /**
     * Stale-while-revalidate for a single record: emits the matching cached
     * item immediately (if any), then fetches fresh, refreshes the cache, and
     * emits that. Lets detail pages paint instantly while the free-tier backend
     * wakes from a cold start instead of blocking on the ~50s spin-up.
     *
     * `match` locates the cached record from the store's contents — used when
     * the lookup key differs from the store key (e.g. by `slug`). Omit it to
     * look up directly by `key`.
     */
    protected staleOne<T>(opts: {
        store: IdbStoreName;
        key?: IDBValidKey;
        match?: (items: T[]) => T | undefined;
        fetch: () => Observable<T>;
    }): Observable<T> {
        return new Observable<T>(subscriber => {
            const cached = opts.match
                ? this.idb.getAll<T>(opts.store).then(opts.match)
                : opts.key != null
                    ? this.idb.get<T>(opts.store, opts.key)
                    : Promise.resolve(undefined);

            cached.then(hit => {
                if (hit) subscriber.next(hit);
            });

            opts.fetch().subscribe({
                next: fresh => {
                    if (fresh) this.idb.put(opts.store, fresh).catch(() => {});
                    subscriber.next(fresh);
                    subscriber.complete();
                },
                error: err => subscriber.error(err),
            });
        });
    }
}
