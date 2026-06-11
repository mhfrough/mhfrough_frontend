import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, tap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ── Data shapes ───────────────────────────────────────────────────────────────

export interface WeatherData {
    temp: number;
    condition: string;       // 'sunny' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunderstorm'
    conditionText: string;
    location: string;
    humidity: number;
    windKph: number;
}

export interface GoldData {
    pricePerTola: number;
    currency: string;
}

export interface UsdPkrData {
    rate: number;
    pair: string;
}

export type WidgetData = WeatherData | GoldData | UsdPkrData;

// ── Cache TTLs ────────────────────────────────────────────────────────────────
// Millisecond TTLs used for client-side localStorage cache of widget data.
const WEATHER_TTL = 15 * 60 * 1000;      // 15 minutes
const GOLD_TTL = 8 * 60 * 60 * 1000;     // 8 hours
const USD_TTL = 60 * 60 * 1000;          // 1 hour

const LS_KEY_WEATHER = 'widget_weather_v1';
const LS_KEY_GOLD = 'widget_gold_v1';
const LS_KEY_USD = 'widget_usd_v1';

interface CacheEntry<T> { data: T; ts: number; }

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class WidgetService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly isBrowser = isPlatformBrowser(this.platformId);

    readonly weatherData = signal<WeatherData | null>(null);
    readonly goldData = signal<GoldData | null>(null);
    readonly usdPkrData = signal<UsdPkrData | null>(null);
    readonly weatherError = signal(false);
    readonly goldError = signal(false);
    readonly usdError = signal(false);

    // ── localStorage helpers ──────────────────────────────────────────────────

    private readCache<T>(key: string, ttl: number): T | null {
        if (!this.isBrowser) return null;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const entry: CacheEntry<T> = JSON.parse(raw);
            if (Date.now() - entry.ts > ttl) return null;
            return entry.data;
        } catch {
            return null;
        }
    }

    private writeCache<T>(key: string, data: T): void {
        if (!this.isBrowser) return;
        try {
            const entry: CacheEntry<T> = { data, ts: Date.now() };
            localStorage.setItem(key, JSON.stringify(entry));
        } catch { /* quota exceeded — ignore */ }
    }

    // ── Public fetch methods ──────────────────────────────────────────────────

    fetchWeather(): Observable<WeatherData> {
        const cached = this.readCache<WeatherData>(LS_KEY_WEATHER, WEATHER_TTL);
        if (cached) { this.weatherData.set(cached); return of(cached); }

        return this.http.get<WeatherData>(`${environment.apiUrl}/widgets/weather`).pipe(
            tap(d => { this.weatherData.set(d); this.writeCache(LS_KEY_WEATHER, d); this.weatherError.set(false); }),
            catchError(() => { this.weatherError.set(true); return of(this.weatherData() as WeatherData); }),
        );
    }

    fetchGold(): Observable<GoldData> {
        const cached = this.readCache<GoldData>(LS_KEY_GOLD, GOLD_TTL);
        if (cached) { this.goldData.set(cached); return of(cached); }

        return this.http.get<GoldData>(`${environment.apiUrl}/widgets/gold`).pipe(
            tap(d => { this.goldData.set(d); this.writeCache(LS_KEY_GOLD, d); this.goldError.set(false); }),
            catchError(() => { this.goldError.set(true); return of(this.goldData() as GoldData); }),
        );
    }

    fetchUsdPkr(): Observable<UsdPkrData> {
        const cached = this.readCache<UsdPkrData>(LS_KEY_USD, USD_TTL);
        if (cached) { this.usdPkrData.set(cached); return of(cached); }

        return this.http.get<UsdPkrData>(`${environment.apiUrl}/widgets/usd-pkr`).pipe(
            tap(d => { this.usdPkrData.set(d); this.writeCache(LS_KEY_USD, d); this.usdError.set(false); }),
            catchError(() => { this.usdError.set(true); return of(this.usdPkrData() as UsdPkrData); }),
        );
    }

    fetchAll(): void {
        this.fetchWeather().subscribe();
        this.fetchGold().subscribe();
        this.fetchUsdPkr().subscribe();
    }

    /** Compact number formatter: 465000 → "465K", 1200000 → "1.2M" */
    formatCompact(n: number): string {
        try {
            return new Intl.NumberFormat('en', {
                notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1,
            }).format(n);
        } catch {
            if (n >= 1_000_000) return Math.round(n / 1_000_000) + 'M';
            if (n >= 1_000) return Math.round(n / 1_000) + 'K';
            return String(Math.round(n));
        }
    }
}
