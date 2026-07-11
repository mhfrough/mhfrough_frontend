import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { SceneService } from './scene.service';
import { HistoryService } from './history.service';
import { WhiteboardApiService, WhiteboardDocumentDto } from './whiteboard-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { WhiteboardElement } from '../models/element.model';

const AUTOSAVE_KEY = 'wb:autosave';
const VERSIONS_KEY = 'wb:versions';
const AUTOSAVE_DEBOUNCE = 600;
const CLOUD_DEBOUNCE = 2500;
const MAX_VERSIONS = 30;
const DEFAULT_TITLE = 'My whiteboard';

export interface BoardVersion {
    id: string;
    label: string;
    timestamp: number;
    elements: WhiteboardElement[];
}

export type CloudState = 'off' | 'syncing' | 'synced' | 'error';

/**
 * Persistence, two tiers:
 * - localStorage autosave + rolling version snapshots (always on, works anonymously);
 * - cloud sync of the scene to the backend /whiteboard document when the admin is
 *   signed in (cookie auth) — local stays the fast path / offline fallback.
 */
@Injectable()
export class PersistenceService {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly isBrowser = isPlatformBrowser(this.platformId);
    private readonly api = inject(WhiteboardApiService);
    private readonly auth = inject(AuthService);

    readonly versions = signal<BoardVersion[]>([]);
    readonly lastSaved = signal<number | null>(null);
    /** Non-null when the last local autosave failed (e.g. localStorage quota exceeded). */
    readonly saveError = signal<string | null>(null);
    readonly cloud = signal<CloudState>('off');

    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private cloudTimer: ReturnType<typeof setTimeout> | null = null;
    private documentId: string | null = null;
    private cloudPushInFlight = false;
    private cloudPushQueued = false;

    constructor(private readonly scene: SceneService, private readonly history: HistoryService) {
        effect(() => {
            const elements = this.scene.elements();
            if (!this.isBrowser) return;
            this.scheduleAutosave(elements);
            this.scheduleCloudPush();
        });
    }

    /** Load autosaved scene + versions, then reconcile with the cloud copy. Call once from the board on init. */
    hydrate(): void {
        if (!this.isBrowser) return;
        this.versions.set(this.readVersions());

        const raw = this.safeGetItem(AUTOSAVE_KEY);
        let localTimestamp = 0;
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as { elements: WhiteboardElement[]; timestamp: number };
                if (Array.isArray(parsed.elements) && parsed.elements.length) {
                    this.scene.replaceAll(parsed.elements);
                    this.lastSaved.set(parsed.timestamp);
                    this.history.reset();
                    localTimestamp = parsed.timestamp;
                }
            } catch {
                /* corrupt autosave — ignore and start fresh */
            }
        }

        if (this.auth.isLoggedIn()) void this.hydrateCloud(localTimestamp);
    }

    saveVersion(label: string): void {
        if (!this.isBrowser) return;
        const version: BoardVersion = {
            id: `v_${Date.now().toString(36)}`,
            label: label.trim() || new Date().toLocaleString(),
            timestamp: Date.now(),
            elements: structuredClone(this.scene.elements() as WhiteboardElement[]),
        };
        const next = [version, ...this.versions()].slice(0, MAX_VERSIONS);
        this.versions.set(next);
        this.safeSetItem(VERSIONS_KEY, JSON.stringify(next), 'Storage full — version not saved locally');
        // Mirror the snapshot server-side when signed in (scene is pushed first so the
        // server snapshots what the user is actually looking at).
        if (this.documentId) {
            const id = this.documentId;
            void this.pushSceneNow().then(ok => {
                if (ok) return firstValueFrom(this.api.snapshot(id, version.label)).catch(() => undefined);
                return undefined;
            });
        }
    }

    restoreVersion(id: string): void {
        const version = this.versions().find(v => v.id === id);
        if (!version) return;
        this.scene.replaceAll(structuredClone(version.elements));
        this.history.commit();
    }

    deleteVersion(id: string): void {
        const next = this.versions().filter(v => v.id !== id);
        this.versions.set(next);
        if (this.isBrowser) this.safeSetItem(VERSIONS_KEY, JSON.stringify(next), null);
    }

    clearAutosave(): void {
        if (this.isBrowser) localStorage.removeItem(AUTOSAVE_KEY);
        this.lastSaved.set(null);
    }

    // ---- local autosave ----------------------------------------------------

    private scheduleAutosave(elements: readonly WhiteboardElement[]): void {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            const payload = { elements, timestamp: Date.now() };
            const ok = this.safeSetItem(
                AUTOSAVE_KEY,
                JSON.stringify(payload),
                'Storage full — board no longer autosaving locally',
            );
            if (ok) this.lastSaved.set(payload.timestamp);
        }, AUTOSAVE_DEBOUNCE);
    }

    /** setItem that reports failure instead of throwing (quota, private mode...). */
    private safeSetItem(key: string, value: string, errorMessage: string | null): boolean {
        try {
            localStorage.setItem(key, value);
            if (errorMessage !== null) this.saveError.set(null);
            return true;
        } catch {
            if (errorMessage !== null) this.saveError.set(errorMessage);
            return false;
        }
    }

    private safeGetItem(key: string): string | null {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    private readVersions(): BoardVersion[] {
        try {
            const raw = this.safeGetItem(VERSIONS_KEY);
            return raw ? (JSON.parse(raw) as BoardVersion[]) : [];
        } catch {
            return [];
        }
    }

    // ---- cloud sync ----------------------------------------------------------

    /**
     * Find (or create) the signed-in user's default board and reconcile: the newer of
     * local autosave vs server scene wins, then both sides converge on it.
     */
    private async hydrateCloud(localTimestamp: number): Promise<void> {
        this.cloud.set('syncing');
        try {
            const docs = await firstValueFrom(this.api.list());
            let doc: WhiteboardDocumentDto | undefined = docs.find(d => d.title === DEFAULT_TITLE) ?? docs[0];
            if (!doc) {
                doc = await firstValueFrom(this.api.create(DEFAULT_TITLE, {
                    elements: this.scene.elements() as WhiteboardElement[],
                    appState: {},
                }));
            }
            this.documentId = doc.id;

            const serverElements = doc.scene?.elements;
            const serverTimestamp = new Date(doc.updatedAt).getTime();
            if (Array.isArray(serverElements) && serverElements.length && serverTimestamp > localTimestamp) {
                this.scene.replaceAll(serverElements);
                this.history.reset();
            } else if (this.scene.elements().length) {
                // Local copy is newer (or server empty) — push it up.
                await this.pushSceneNow();
            }
            this.cloud.set('synced');
        } catch {
            // Not signed in server-side / network down — stay local-only.
            this.documentId = null;
            this.cloud.set('off');
        }
    }

    private scheduleCloudPush(): void {
        if (!this.documentId) return;
        if (this.cloudTimer) clearTimeout(this.cloudTimer);
        this.cloudTimer = setTimeout(() => void this.pushSceneNow(), CLOUD_DEBOUNCE);
    }

    /** Serialized PUT of the current scene; overlapping calls coalesce into one trailing push. */
    private async pushSceneNow(): Promise<boolean> {
        if (!this.documentId) return false;
        if (this.cloudPushInFlight) {
            this.cloudPushQueued = true;
            return true;
        }
        this.cloudPushInFlight = true;
        this.cloud.set('syncing');
        try {
            await firstValueFrom(this.api.updateScene(this.documentId, {
                elements: this.scene.elements() as WhiteboardElement[],
                appState: {},
            }));
            this.cloud.set('synced');
            return true;
        } catch {
            this.cloud.set('error');
            return false;
        } finally {
            this.cloudPushInFlight = false;
            if (this.cloudPushQueued) {
                this.cloudPushQueued = false;
                void this.pushSceneNow();
            }
        }
    }
}
