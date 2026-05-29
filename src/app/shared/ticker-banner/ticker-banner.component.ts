import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TickerService, TickerMessage } from '../../core/services/ticker.service';

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
        <div class="ticker-track">
            @for (item of tickers(); track item.id) {
            <span class="ticker-item">{{ item.message }}</span>
            <span class="ticker-sep" aria-hidden="true">·</span>
            }
            <!-- duplicate for seamless infinite loop -->
            @for (item of tickers(); track 'dup-' + item.id) {
            <span class="ticker-item">{{ item.message }}</span>
            <span class="ticker-sep" aria-hidden="true">·</span>
            }
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

.ticker-track {
    display: flex;
    align-items: center;
    white-space: nowrap;
    animation: ticker-scroll 40s linear infinite;
}

.ticker-track:hover {
    animation-play-state: paused;
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
export class TickerBannerComponent implements OnInit {
    private readonly tickerService = inject(TickerService);
    private readonly platformId = inject(PLATFORM_ID);

    readonly tickers = signal<TickerMessage[]>([]);
    readonly visible = signal(false);

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        if (sessionStorage.getItem(SESSION_KEY)) return;

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

    dismiss() {
        this.visible.set(false);
        if (isPlatformBrowser(this.platformId)) {
            sessionStorage.setItem(SESSION_KEY, '1');
        }
    }
}
