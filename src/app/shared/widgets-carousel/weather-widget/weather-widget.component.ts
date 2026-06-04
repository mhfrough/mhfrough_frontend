import { Component, Input, OnChanges, inject } from '@angular/core';
import { WidgetService, WeatherData } from '../../../core/services/widget.service';

export type WeatherIcon = 'sunny' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunderstorm';

const CONDITION_LABELS: Record<WeatherIcon, string> = {
  'sunny': 'Sunny',
  'cloudy': 'Cloudy',
  'fog': 'Fog',
  'rain': 'Rain',
  'snow': 'Snow',
  'thunderstorm': 'Thunderstorm',
};

@Component({
  selector: 'app-weather-widget',
  standalone: true,
  imports: [],
  templateUrl: './weather-widget.component.html',
  styleUrls: ['./weather-widget.component.scss'],
})
export class WeatherWidgetComponent implements OnChanges {
  /** Injected data from the carousel parent; falls back to service signal */
  @Input() weatherData: WeatherData | null = null;

  readonly widgetService = inject(WidgetService);

  get data(): WeatherData | null {
    return this.weatherData ?? this.widgetService.weatherData();
  }

  get conditionKey(): string {
    return (this.data?.condition || 'sunny').toLowerCase().replace(/\s+/g, '-');
  }

  get displayTemp(): string {
    const d = this.data;
    return d ? `${d.temp}°C` : '—';
  }

  get displayLabel(): string {
    return CONDITION_LABELS[this.conditionKey as WeatherIcon] ?? this.data?.conditionText ?? 'Weather';
  }

  get location(): string {
    return this.data?.location ?? '';
  }

  ngOnChanges(): void { /* triggers re-evaluation of getters */ }
}
