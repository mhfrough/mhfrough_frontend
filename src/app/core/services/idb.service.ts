import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { openDB, type IDBPDatabase } from 'idb';

export type IdbStoreName =
    | 'blogs'
    | 'projects'
    | 'gallery'
    | 'notifications'
    | 'chat_messages'
    | 'admin_cache'
    | 'sync_queue';

const DB_NAME = 'mhfrough_db';
const DB_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class IdbService {
    private readonly platformId = inject(PLATFORM_ID);
    private dbPromise: Promise<IDBPDatabase> | null = null;

    private getDb(): Promise<IDBPDatabase> | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        if (!this.dbPromise) {
            this.dbPromise = openDB(DB_NAME, DB_VERSION, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains('blogs')) {
                        const blogsStore = db.createObjectStore('blogs', { keyPath: 'id' });
                        blogsStore.createIndex('slug', 'slug', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('projects')) {
                        db.createObjectStore('projects', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('gallery')) {
                        db.createObjectStore('gallery', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('notifications')) {
                        db.createObjectStore('notifications', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('chat_messages')) {
                        const chatStore = db.createObjectStore('chat_messages', { keyPath: 'id' });
                        chatStore.createIndex('sessionId', 'sessionId', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('admin_cache')) {
                        db.createObjectStore('admin_cache', { keyPath: 'key' });
                    }
                    if (!db.objectStoreNames.contains('sync_queue')) {
                        const queueStore = db.createObjectStore('sync_queue', { autoIncrement: true, keyPath: 'id' });
                        queueStore.createIndex('status', 'status', { unique: false });
                    }
                },
            });
        }
        return this.dbPromise;
    }

    async get<T>(store: IdbStoreName, key: IDBValidKey): Promise<T | undefined> {
        const db = await this.getDb();
        if (!db) return undefined;
        return db.get(store, key);
    }

    async getAll<T>(store: IdbStoreName): Promise<T[]> {
        const db = await this.getDb();
        if (!db) return [];
        return db.getAll(store);
    }

    async getAllByIndex<T>(store: IdbStoreName, index: string, value: IDBValidKey): Promise<T[]> {
        const db = await this.getDb();
        if (!db) return [];
        return db.getAllFromIndex(store, index, value);
    }

    async put<T>(store: IdbStoreName, value: T): Promise<void> {
        const db = await this.getDb();
        if (!db) return;
        await db.put(store, value);
    }

    async putMany<T>(store: IdbStoreName, values: T[]): Promise<void> {
        const db = await this.getDb();
        if (!db || !values.length) return;
        const tx = db.transaction(store, 'readwrite');
        await Promise.all([...values.map(v => tx.store.put(v)), tx.done]);
    }

    async delete(store: IdbStoreName, key: IDBValidKey): Promise<void> {
        const db = await this.getDb();
        if (!db) return;
        await db.delete(store, key);
    }

    async clear(store: IdbStoreName): Promise<void> {
        const db = await this.getDb();
        if (!db) return;
        await db.clear(store);
    }

    async count(store: IdbStoreName): Promise<number> {
        const db = await this.getDb();
        if (!db) return 0;
        return db.count(store);
    }
}
