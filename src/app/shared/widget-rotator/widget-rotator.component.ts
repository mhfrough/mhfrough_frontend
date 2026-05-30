import { Component, AfterViewInit, OnDestroy, Input, inject, PLATFORM_ID, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { AuthService } from '../../core/services/auth.service';
import { WeatherWidgetComponent } from '../weather-widget/weather-widget.component';
import { UsdPkrWidgetComponent } from '../usd-pkr-widget/usd-pkr-widget.component';
import { GoldTolaWidgetComponent } from '../gold-tola-widget/gold-tola-widget.component';

@Component({
  selector: 'app-widget-rotator',
  standalone: true,
  imports: [CommonModule, WeatherWidgetComponent, UsdPkrWidgetComponent, GoldTolaWidgetComponent],
  templateUrl: './widget-rotator.component.html',
  styleUrls: ['./widget-rotator.component.scss'],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ height: 0, opacity: 0, transform: 'translateY(-8px)' }),
        animate('300ms cubic-bezier(0.2,0.8,0.2,1)', style({ height: '*', opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.2,0.8,0.2,1)', style({ height: 0, opacity: 0, transform: 'translateY(-8px)' }))
      ])
    ])
  ],
})
export class WidgetRotatorComponent implements AfterViewInit, OnDestroy {
  /** Rotation interval in milliseconds */
  @Input() interval = 5000;

  currentIndex = 0;
  private timerId: any;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);
  readonly auth = inject(AuthService);

  readonly items = ['weather', 'usd', 'gold'];

  ngAfterViewInit(): void {
    // Only run rotation in the browser (avoids SSR timers)
    if (!isPlatformBrowser(this.platformId)) return;
    // Defer starting the interval to the next macrotask so initial change-detection
    // has settled. Start the interval outside Angular for performance, run updates
    // inside the zone. Also guard rotation so it only advances when the user is logged in.
    setTimeout(() => {
      this.zone.runOutsideAngular(() => {
        this.timerId = setInterval(() => {
          this.zone.run(() => {
            try {
              // lightweight debug - helps verify the timer is firing in the browser
              if (typeof console !== 'undefined' && console.debug) console.debug('[WidgetRotator] tick ->', this.currentIndex);
            } catch { }
            // Only rotate when the user is logged in (prevents toggles from hidden state)
            try {
              if (this.auth.isLoggedIn()) this.next();
            } catch { }
          });
        }, this.interval);
      });
    }, 0);

  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = undefined;
      try { if (typeof console !== 'undefined' && console.debug) console.debug('[WidgetRotator] timer cleared'); } catch { }
    }
  }

  next(): void {
    this.currentIndex = (this.currentIndex + 1) % this.items.length;
    try { if (typeof console !== 'undefined' && console.debug) console.debug('[WidgetRotator] new index ->', this.currentIndex); } catch { }
  }

  prev(): void {
    this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
  }

  show(index: number): void {
    if (index >= 0 && index < this.items.length) this.currentIndex = index;
  }
}
