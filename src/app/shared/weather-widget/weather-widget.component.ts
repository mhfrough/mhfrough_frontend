import { Component, Input, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-weather-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weather-widget.component.html',
  styleUrls: ['./weather-widget.component.scss'],
})
export class WeatherWidgetComponent implements OnInit {
  // Dummy data for initial frontend-only implementation
  @Input() temperature = '21°C';
  @Input() condition = 'sunny';
  @Input() location = 'London';

  // Local display condition (can be overridden by dev control)
  displayCondition = '';
  showDevControl = false;

  readonly WEATHER_OPTIONS = [
    { key: 'sunny', label: 'Sunny' },
    { key: 'partly-cloudy', label: 'Partly Cloudy' },
    { key: 'cloudy', label: 'Cloudy' },
    { key: 'fog', label: 'Fog' },
    { key: 'rain', label: 'Rain' },
    { key: 'snow', label: 'Snow' },
    { key: 'sleet', label: 'Sleet' },
    { key: 'thunderstorm', label: 'Thunderstorm' },
  ] as const;

  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    // Initialize display state
    this.displayCondition = (this.condition || 'sunny').toLowerCase().trim().replace(/\s+/g, '-');
    // Enable dev control when URL contains ?weatherDev=1 (browser only)
    if (isPlatformBrowser(this.platformId)) {
      try {
        const params = new URLSearchParams(window.location.search || '');
        this.showDevControl = params.has('weatherDev') || params.get('weatherDev') === '1';
      } catch {
        this.showDevControl = false;
      }
    }
  }

  onDevChange(val: string) {
    this.displayCondition = (val || 'sunny').toLowerCase().trim().replace(/\s+/g, '-');
  }

  get conditionKey(): string {
    return (this.displayCondition || '').toLowerCase().trim().replace(/\s+/g, '-');
  }

  get displayLabel(): string {
    const found = this.WEATHER_OPTIONS.find(o => o.key === this.conditionKey);
    return found ? found.label : this.displayCondition;
  }

  get iconClass(): string {
    switch (this.conditionKey) {
      case 'sunny':
        return 'bi-sun';
      case 'partly-cloudy':
        return 'bi-cloud-sun';
      case 'cloudy':
        return 'bi-cloud';
      case 'fog':
        return 'bi-cloud-fog';
      case 'rain':
        return 'bi-cloud-rain';
      case 'snow':
        return 'bi-cloud-snow';
      case 'sleet':
        return 'bi-cloud-hail';
      case 'thunderstorm':
        return 'bi-cloud-lightning';
      default:
        return 'bi-cloud-sun';
    }
  }
}
