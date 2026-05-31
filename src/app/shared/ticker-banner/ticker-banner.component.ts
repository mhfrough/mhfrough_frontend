import { Component, OnInit, OnDestroy, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { TickerService, TickerMessage } from '../../core/services/ticker.service';
import { RealtimeService } from '../../core/services/realtime.service';

const SESSION_KEY = 'ticker_dismissed';

@Component({
    selector: 'app-ticker-banner',
    standalone: true,
    imports: [CommonModule],
    template: `
@if (visible() && tickers().length > 0) {
<div class="ticker-banner" role="marquee" aria-label="Site announcements">
    <span class="ticker-label" aria-hidden="true"><i class="bi bi-megaphone-fill"></i></span>
    <div class="ticker-track-wrap">
        <div class="ticker-scroll">
            <!-- First track -->
            <div class="ticker-track">
                @for (item of displayTickers(); track $index + '-a') {
                <span class="ticker-item">{{ item.message }}</span>
                <span class="ticker-sep" aria-hidden="true">·</span>
                }
            </div>
            <!-- Duplicate for seamless infinite loop -->
            <div class="ticker-track" aria-hidden="true">
                @for (item of displayTickers(); track $index + '-b') {
                <span class="ticker-item">{{ item.message }}</span>
                <span class="ticker-sep" aria-hidden="true">·</span>
                }
            </div>
        </div>
    </div>
    <button class="ticker-close" (click)="dismiss()" aria-label="Dismiss ticker">
        <i class="bi bi-x"></i>
    </button>
</div>
}
    `,
    styles: [`
:host {
    display: block;
}

.ticker-banner {
    display: flex;
    align-items: center;
    background: #242220;
    color: #928e87;
    font-size: 0.78rem;
    height: 32px;
    overflow: hidden;
    border-bottom: 1px solid rgba(228, 224, 216, 0.08);
    letter-spacing: 0.02em;
}

.ticker-label {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 0 0.75rem;
    height: 100%;
    color: #928e87;
    font-size: 0.72rem;
    border-right: 1px solid rgba(228, 224, 216, 0.08);
}

.ticker-track-wrap {
    flex: 1;
    overflow: hidden;
    height: 100%;
    display: flex;
    align-items: center;
    mask-image: linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%);
}

.ticker-scroll {
    display: flex;
    width: max-content;
    animation: ticker-scroll 90s linear infinite;
}

.ticker-scroll:hover {
    animation-play-state: paused;
}

.ticker-track {
    display: flex;
    align-items: center;
    white-space: nowrap;
    flex-shrink: 0;
}

.ticker-item {
    padding: 0 1.25rem;
    color: #928e87;
}

.ticker-sep {
    opacity: 0.3;
    font-size: 0.55rem;
    color: #928e87;
}

.ticker-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    border-left: 1px solid rgba(228, 224, 216, 0.08);
    color: #928e87;
    cursor: pointer;
    font-size: 0.95rem;
    transition: color 160ms ease, background 160ms ease;
    padding: 0;
}

.ticker-close:hover {
    color: #e4e0d8;
    background: rgba(228, 224, 216, 0.06);
}

@keyframes ticker-scroll {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
}
    `],
})
export class TickerBannerComponent implements OnInit, OnDestroy {
    private readonly tickerService = inject(TickerService);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly realtime = inject(RealtimeService);
    private subs = new Subscription();
    private showTimer: ReturnType<typeof setTimeout> | null = null;

    readonly tickers = signal<TickerMessage[]>([]);
    readonly visible = signal(false);

    /** Repeat items enough times so one track always overflows the viewport. */
    readonly displayTickers = computed(() => {
        const items = this.tickers();
        if (!items.length) return [];
        const reps = Math.max(1, Math.ceil(12 / items.length));
        return Array.from({ length: reps }, () => items).flat();
    });

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        if (sessionStorage.getItem(SESSION_KEY)) return;
        // Show after 10s (same delay as cookie consent) regardless of cookie consent
        this.showTimer = setTimeout(() => {
            if (sessionStorage.getItem(SESSION_KEY)) return;
            this.loadPublished();
        }, 10000);

        // Realtime: reflect ticker changes instantly and auto-show (unless dismissed)
        this.subs.add(this.realtime.on<TickerMessage>('ticker:created').subscribe(msg => {
            this.tickers.update(list => [msg, ...list]);
            if (!sessionStorage.getItem(SESSION_KEY)) this.visible.set(true);
        }));
        this.subs.add(this.realtime.on<TickerMessage>('ticker:updated').subscribe(msg => {
            this.tickers.update(list => {
                const idx = list.findIndex(t => t.id === msg.id);
                return idx >= 0 ? list.map(t => t.id === msg.id ? msg : t) : [msg, ...list];
            });
            if (this.tickers().length > 0 && !sessionStorage.getItem(SESSION_KEY)) this.visible.set(true);
        }));
        this.subs.add(this.realtime.on<{ id: string }>('ticker:deleted').subscribe(({ id }) => {
            this.tickers.update(list => list.filter(t => t.id !== id));
            if (this.tickers().length === 0) this.visible.set(false);
        }));
    }

    ngOnDestroy() {
        this.subs.unsubscribe();
        if (this.showTimer !== null) clearTimeout(this.showTimer);
    }

    dismiss() {
        this.visible.set(false);
        if (isPlatformBrowser(this.platformId)) {
            sessionStorage.setItem(SESSION_KEY, '1');
        }
    }

    private loadPublished() {
        this.tickerService.getPublished().subscribe({
            next: (items) => {
                if (items.length > 0) {
                    this.tickers.set(items);
                    this.visible.set(true);
                }
            },
            error: () => { /* non-critical — silently ignore */ },
        });
    }
}
