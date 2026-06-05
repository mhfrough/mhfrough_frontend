import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSettingsService, AdminSettings } from '../../../../../core/services/admin-settings.service';

@Component({
    selector: 'app-settings-widgets',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './settings-widgets.component.html',
})
export class SettingsWidgetsComponent implements OnInit {
    private readonly settingsService = inject(AdminSettingsService);

    readonly widgetsSaving = signal(false);
    readonly widgetsSaved = signal(false);
    readonly widgetsError = signal('');

    widgetWeatherKey = '';
    widgetGoldKey = '';
    widgetCurrencyKey = '';
    widgetCity = 'Karachi';

    get settings() { return this.settingsService.settings(); }

    ngOnInit() {
        this.settingsService.load();
        this.syncFromSettings(this.settingsService.settings());
        if (!this.settingsService.loaded()) {
            const poll = setInterval(() => {
                if (this.settingsService.loaded()) {
                    this.syncFromSettings(this.settingsService.settings());
                    clearInterval(poll);
                }
            }, 100);
        }
    }

    private syncFromSettings(s: AdminSettings) {
        this.widgetWeatherKey = s.weatherApiKey ? '••••••••' : '';
        this.widgetGoldKey = s.goldApiKey ? '••••••••' : '';
        this.widgetCurrencyKey = s.currencyApiKey ? '••••••••' : '';
        this.widgetCity = s.weatherCity ?? 'Karachi';
    }

    private resolveKey(val: string): string | undefined {
        return val && !val.startsWith('••') ? val : undefined;
    }

    saveWidgetKeys(): void {
        this.widgetsSaving.set(true);
        this.widgetsSaved.set(false);
        this.widgetsError.set('');

        const payload: Partial<AdminSettings> = { weatherCity: this.widgetCity || 'Karachi' };
        const wk = this.resolveKey(this.widgetWeatherKey);
        const gk = this.resolveKey(this.widgetGoldKey);
        const ck = this.resolveKey(this.widgetCurrencyKey);
        if (wk) payload['weatherApiKey'] = wk;
        if (gk) payload['goldApiKey'] = gk;
        if (ck) payload['currencyApiKey'] = ck;

        this.settingsService.update(payload).subscribe({
            next: () => {
                this.widgetsSaving.set(false);
                this.widgetsSaved.set(true);
                setTimeout(() => this.widgetsSaved.set(false), 3000);
            },
            error: () => {
                this.widgetsSaving.set(false);
                this.widgetsError.set('Failed to save widget keys. Please try again.');
            },
        });
    }
}
