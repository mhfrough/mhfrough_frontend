import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSettingsService, AdminSettings, DeploymentOverview, GithubCommitInfo, RenderStatusInfo } from '../../../../../core/services/admin-settings.service';

@Component({
    selector: 'app-settings-health',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './settings-health.component.html',
})
export class SettingsHealthComponent implements OnInit {
    private readonly settingsService = inject(AdminSettingsService);

    readonly healthSaving = signal(false);
    readonly healthSaved = signal(false);
    readonly healthError = signal('');

    readonly overview = signal<DeploymentOverview | null>(null);
    readonly overviewLoading = signal(false);
    readonly overviewError = signal('');

    githubToken = '';
    githubRepoBackend = '';
    githubRepoFrontend = '';
    renderApiKey = '';
    renderServiceIdBackend = '';
    renderServiceIdFrontend = '';
    renderPostgresId = '';

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
        this.loadOverview();
    }

    private syncFromSettings(s: AdminSettings) {
        this.githubToken = s.githubToken ? '••••••••' : '';
        this.githubRepoBackend = s.githubRepoBackend ?? '';
        this.githubRepoFrontend = s.githubRepoFrontend ?? '';
        this.renderApiKey = s.renderApiKey ? '••••••••' : '';
        this.renderServiceIdBackend = s.renderServiceIdBackend ?? '';
        this.renderServiceIdFrontend = s.renderServiceIdFrontend ?? '';
        this.renderPostgresId = s.renderPostgresId ?? '';
    }

    private resolveSecret(val: string): string | undefined {
        return val && !val.startsWith('••') ? val : undefined;
    }

    loadOverview(): void {
        this.overviewLoading.set(true);
        this.overviewError.set('');
        this.settingsService.getDeploymentOverview().subscribe({
            next: (data) => {
                this.overview.set(data);
                this.overviewLoading.set(false);
            },
            error: () => {
                this.overviewError.set('Failed to load deployment health.');
                this.overviewLoading.set(false);
            },
        });
    }

    saveHealthConfig(): void {
        this.healthSaving.set(true);
        this.healthSaved.set(false);
        this.healthError.set('');

        const payload: Partial<AdminSettings> = {
            githubRepoBackend: this.githubRepoBackend || undefined,
            githubRepoFrontend: this.githubRepoFrontend || undefined,
            renderServiceIdBackend: this.renderServiceIdBackend || undefined,
            renderServiceIdFrontend: this.renderServiceIdFrontend || undefined,
            renderPostgresId: this.renderPostgresId || undefined,
        };
        const gt = this.resolveSecret(this.githubToken);
        const rk = this.resolveSecret(this.renderApiKey);
        if (gt) payload['githubToken'] = gt;
        if (rk) payload['renderApiKey'] = rk;

        this.settingsService.update(payload).subscribe({
            next: () => {
                this.healthSaving.set(false);
                this.healthSaved.set(true);
                setTimeout(() => this.healthSaved.set(false), 3000);
                this.loadOverview();
            },
            error: () => {
                this.healthSaving.set(false);
                this.healthError.set('Failed to save deployment health settings. Please try again.');
            },
        });
    }

    get commitEntries(): { label: string; info: GithubCommitInfo }[] {
        const ov = this.overview();
        const empty: GithubCommitInfo = { error: 'not_configured' };
        return [
            { label: 'Backend', info: ov?.github?.backend ?? empty },
            { label: 'Frontend', info: ov?.github?.frontend ?? empty },
        ];
    }

    get renderEntries(): { label: string; info: RenderStatusInfo }[] {
        const ov = this.overview();
        const empty: RenderStatusInfo = { error: 'not_configured' };
        return [
            { label: 'Backend', info: ov?.render?.backend ?? empty },
            { label: 'Frontend', info: ov?.render?.frontend ?? empty },
        ];
    }

    statusColor(status?: string): string {
        if (!status) return 'var(--text-muted)';
        if (['live', 'success', 'succeeded', 'available'].includes(status)) return '#4ade80';
        if (['build_in_progress', 'update_in_progress', 'pre_deploy_in_progress', 'queued', 'creating'].includes(status)) return '#d97706';
        if (['build_failed', 'update_failed', 'deactivated', 'canceled', 'suspended', 'expired'].includes(status)) return '#dc2626';
        return 'var(--text-muted)';
    }
}
