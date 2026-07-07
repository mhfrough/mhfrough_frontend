import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'wb:recentColors';
const MAX_RECENT = 8;

/** Shared, persisted list of recently used colors (newest first) across every color field. */
@Injectable({ providedIn: 'root' })
export class RecentColorsService {
    readonly colors = signal<string[]>(this.load());

    add(color: string): void {
        if (!color || color === 'transparent') return;
        const next = [color, ...this.colors().filter(c => c !== color)].slice(0, MAX_RECENT);
        this.colors.set(next);
        this.save(next);
    }

    private load(): string[] {
        if (typeof localStorage === 'undefined') return [];
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.filter(c => typeof c === 'string') : [];
        } catch {
            return [];
        }
    }

    private save(colors: string[]): void {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
        } catch {
            /* storage full / unavailable — recent colors are best-effort */
        }
    }
}
