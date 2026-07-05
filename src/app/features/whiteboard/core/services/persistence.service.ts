import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SceneService } from './scene.service';
import { HistoryService } from './history.service';
import { WhiteboardElement } from '../models/element.model';

const AUTOSAVE_KEY = 'wb:autosave';
const VERSIONS_KEY = 'wb:versions';
const AUTOSAVE_DEBOUNCE = 600;
const MAX_VERSIONS = 30;

export interface BoardVersion {
    id: string;
    label: string;
    timestamp: number;
    elements: WhiteboardElement[];
}

/** Auto-saves the scene to localStorage and keeps a rolling list of named version snapshots. */
@Injectable()
export class PersistenceService {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly isBrowser = isPlatformBrowser(this.platformId);

    readonly versions = signal<BoardVersion[]>([]);
    readonly lastSaved = signal<number | null>(null);

    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly scene: SceneService, private readonly history: HistoryService) {
        effect(() => {
            const elements = this.scene.elements();
            if (!this.isBrowser) return;
            this.scheduleAutosave(elements);
        });
    }

    /** Load autosaved scene + versions. Call once from the board on init. */
    hydrate(): void {
        if (!this.isBrowser) return;
        this.versions.set(this.readVersions());

        const raw = localStorage.getItem(AUTOSAVE_KEY);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw) as { elements: WhiteboardElement[]; timestamp: number };
            if (Array.isArray(parsed.elements) && parsed.elements.length) {
                this.scene.replaceAll(parsed.elements);
                this.lastSaved.set(parsed.timestamp);
                this.history.reset();
            }
        } catch {
            /* corrupt autosave — ignore and start fresh */
        }
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
        localStorage.setItem(VERSIONS_KEY, JSON.stringify(next));
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
        if (this.isBrowser) localStorage.setItem(VERSIONS_KEY, JSON.stringify(next));
    }

    clearAutosave(): void {
        if (this.isBrowser) localStorage.removeItem(AUTOSAVE_KEY);
        this.lastSaved.set(null);
    }

    private scheduleAutosave(elements: readonly WhiteboardElement[]): void {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            const payload = { elements, timestamp: Date.now() };
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
            this.lastSaved.set(payload.timestamp);
        }, AUTOSAVE_DEBOUNCE);
    }

    private readVersions(): BoardVersion[] {
        try {
            const raw = localStorage.getItem(VERSIONS_KEY);
            return raw ? (JSON.parse(raw) as BoardVersion[]) : [];
        } catch {
            return [];
        }
    }
}
