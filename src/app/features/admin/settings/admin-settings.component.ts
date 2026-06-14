import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { SettingsProfileComponent } from './tabs/profile/settings-profile.component';
import { SettingsSecurityComponent } from './tabs/security/settings-security.component';
import { SettingsNotificationsComponent } from './tabs/notifications/settings-notifications.component';
import { SettingsTickerComponent } from './tabs/ticker/settings-ticker.component';
import { SettingsIntegrationsComponent } from './tabs/integrations/settings-integrations.component';
import { SettingsDataComponent } from './tabs/data/settings-data.component';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'integrations' | 'ticker' | 'data';

const TAB_TITLES: Record<SettingsTab, string> = {
    profile: 'Profile Settings',
    security: 'Security Settings',
    notifications: 'Notification Settings',
    integrations: 'Integrations',
    ticker: 'Ticker Settings',
    data: 'Data & Danger Zone',
};

const VALID_TABS: SettingsTab[] = ['profile', 'security', 'notifications', 'integrations', 'ticker', 'data'];

@Component({
    selector: 'app-admin-settings',
    standalone: true,
    imports: [
        RouterLink,
        SettingsProfileComponent,
        SettingsSecurityComponent,
        SettingsNotificationsComponent,
        SettingsIntegrationsComponent,
        SettingsTickerComponent,
        SettingsDataComponent,
    ],
    templateUrl: './admin-settings.component.html',
})
export class AdminSettingsComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly titleService = inject(Title);

    readonly activeTab = signal<SettingsTab>('profile');

    ngOnInit() {
        this.route.paramMap.subscribe(params => {
            const tab = params.get('tab') as SettingsTab;
            if (tab && VALID_TABS.includes(tab)) {
                this.activeTab.set(tab);
                this.titleService.setTitle(`${TAB_TITLES[tab]} | Admin`);
            }
        });
    }
}
