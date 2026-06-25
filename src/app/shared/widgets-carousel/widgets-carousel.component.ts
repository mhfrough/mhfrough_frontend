import {
  Component, OnInit, OnDestroy, inject, signal, computed, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { WidgetService } from '../../core/services/widget.service';
import { AuthService } from '../../core/services/auth.service';
import { WeatherWidgetComponent } from './weather-widget/weather-widget.component';
import { GoldTolaWidgetComponent } from './gold-tola-widget/gold-tola-widget.component';
import { UsdPkrWidgetComponent } from './usd-pkr-widget/usd-pkr-widget.component';

type WidgetId = 'weather' | 'gold' | 'usd';

@Component({
  selector: 'app-widgets-carousel',
  standalone: true,
  imports: [WeatherWidgetComponent, GoldTolaWidgetComponent, UsdPkrWidgetComponent],
  template: `
@if (visible() && isAdmin && current()) {
<div class="widgets-carousel" aria-label="Live data widgets">
  <div class="carousel-track" [class.carousel-track--fading]="fading()">
    @switch (current()) {
      @case ('weather') {
        <app-weather-widget [weatherData]="widgetService.weatherData()" />
      }
      @case ('gold') {
        <app-gold-tola-widget [goldData]="widgetService.goldData()" />
      }
      @case ('usd') {
        <app-usd-pkr-widget [usdPkrData]="widgetService.usdPkrData()" />
      }
    }
  </div>
</div>
}
    `,
  styles: [`
:host { display: contents; }

.widgets-carousel {
  display: flex;
  align-items: center;
}

.carousel-track {
  min-width: 0;
  opacity: 1;
  transition: opacity 300ms var(--ease);
  &--fading { opacity: 0; }
}
    `],
})
export class WidgetsCarouselComponent implements OnInit, OnDestroy {
  readonly widgetService = inject(WidgetService);
  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  readonly visible = signal(false);
  readonly active = signal(0);
  readonly fading = signal(false);

  /** Widgets that actually returned valid data — others are skipped entirely. */
  readonly available = computed<WidgetId[]>(() => {
    const ids: WidgetId[] = [];
    if (this.widgetService.weatherData()) ids.push('weather');
    if (this.widgetService.goldData()) ids.push('gold');
    if (this.widgetService.usdPkrData()) ids.push('usd');
    return ids;
  });

  /** The widget currently shown, or null when none have data. */
  readonly current = computed<WidgetId | null>(() => {
    const list = this.available();
    return list.length ? list[this.active() % list.length] : null;
  });

  get isAdmin(): boolean { return this.authService.adminWidgetVisible(); }

  private timer: ReturnType<typeof setInterval> | null = null;
  private visibleTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Fetch all widget data (respects localStorage TTL)
    this.widgetService.fetchAll();

    // Delay appearance by 7 s — same as chat widget
    this.visibleTimer = setTimeout(() => {
      this.visible.set(true);
      // Start rotation
      this.timer = setInterval(() => this.advance(), 5000);
    }, 7000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.visibleTimer) clearTimeout(this.visibleTimer);
  }

  private advance(): void {
    const count = this.available().length;
    if (count <= 1) return; // nothing to rotate to
    this.fading.set(true);
    setTimeout(() => {
      this.active.set((this.active() + 1) % count);
      this.fading.set(false);
    }, 300);
  }

  jumpTo(idx: number): void {
    if (idx === this.active() || idx >= this.available().length) return;
    if (this.timer) clearInterval(this.timer);
    this.fading.set(true);
    setTimeout(() => {
      this.active.set(idx);
      this.fading.set(false);
      this.timer = setInterval(() => this.advance(), 5000);
    }, 300);
  }
}
