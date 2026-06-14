import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
// Monitoring views are physically grouped under settings/tabs but belong to Insights.
import { SettingsVisitorsComponent } from '../settings/tabs/visitors/settings-visitors.component';
import { SettingsAnalyticsComponent } from '../settings/tabs/analytics/settings-analytics.component';
import { SettingsHealthComponent } from '../settings/tabs/health/settings-health.component';
import { InsightsActivityComponent } from './tabs/activity/insights-activity.component';

type InsightsTab = 'visitors' | 'analytics' | 'activity' | 'health';

const TAB_TITLES: Record<InsightsTab, string> = {
    visitors: 'Visitor Analytics',
    analytics: 'Analytics & Reports',
    activity: 'Activity Logs',
    health: 'Deployment Health',
};

const VALID_TABS: InsightsTab[] = ['visitors', 'analytics', 'activity', 'health'];

@Component({
    selector: 'app-admin-insights',
    standalone: true,
    imports: [
        RouterLink,
        SettingsVisitorsComponent,
        SettingsAnalyticsComponent,
        SettingsHealthComponent,
        InsightsActivityComponent,
    ],
    templateUrl: './admin-insights.component.html',
})
export class AdminInsightsComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly titleService = inject(Title);

    readonly activeTab = signal<InsightsTab>('visitors');

    ngOnInit() {
        this.route.paramMap.subscribe(params => {
            const tab = params.get('tab') as InsightsTab;
            if (tab && VALID_TABS.includes(tab)) {
                this.activeTab.set(tab);
                this.titleService.setTitle(`${TAB_TITLES[tab]} | Admin`);
            }
        });
    }
}
