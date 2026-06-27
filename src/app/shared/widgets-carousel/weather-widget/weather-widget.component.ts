import { Component, Input, OnChanges, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WidgetService, WeatherData } from '../../../core/services/widget.service';
import { VisitorAuthService } from '../../../core/services/visitor-auth.service';

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
    imports: [CommonModule],
    templateUrl: './weather-widget.component.html',
    styleUrls: ['./weather-widget.component.scss'],
})
export class WeatherWidgetComponent implements OnChanges, OnInit {
    @Input() weatherData: WeatherData | null = null;

    readonly widgetService = inject(WidgetService);
    readonly visitorAuth = inject(VisitorAuthService);

    avatarHovered = false;
    loginOpen = false;

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

    get visitorProfile() { return this.visitorAuth.visitorProfile(); }
    get enabledProviders() { return this.visitorAuth.enabledProviders(); }
    get authLoaded() { return this.visitorAuth.loaded(); }

    providerIcon(provider: string): string {
        const icons: Record<string, string> = {
            google: 'bi-google',
            github: 'bi-github',
            linkedin: 'bi-linkedin',
            discord: 'bi-discord',
        };
        return icons[provider] ?? 'bi-person';
    }

    ngOnInit() {
        this.visitorAuth.init();
    }

    ngOnChanges(): void { /* re-evaluate getters on @Input change */ }

    onAvatarEnter() { this.avatarHovered = true; }
    onAvatarLeave() { this.avatarHovered = false; }

    toggleLogin(e: MouseEvent) {
        e.stopPropagation();
        this.loginOpen = !this.loginOpen;
    }

    closeLogin() { this.loginOpen = false; }

    loginWith(provider: string) {
        this.loginOpen = false;
        this.visitorAuth.loginWith(provider);
    }

    logout() {
        this.avatarHovered = false;
        this.loginOpen = false;
        this.visitorAuth.logout().subscribe();
    }
}
