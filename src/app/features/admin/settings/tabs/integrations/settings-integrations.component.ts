import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSettingsService, AdminSettings } from '../../../../../core/services/admin-settings.service';
import { SettingsWidgetsComponent } from '../widgets/settings-widgets.component';

@Component({
    selector: 'app-settings-integrations',
    standalone: true,
    imports: [CommonModule, FormsModule, SettingsWidgetsComponent],
    templateUrl: './settings-integrations.component.html',
})
export class SettingsIntegrationsComponent implements OnInit {
    private readonly settingsService = inject(AdminSettingsService);

    // ── AI Chat Auto-Reply ────────────────────────────────────────────────────
    readonly aiSaving = signal(false);
    readonly aiSaved = signal(false);
    readonly aiError = signal('');

    aiEnabled = false;
    aiApiKey = '';
    aiTone = 'professional';
    aiInstruction = '';
    aiAutoReplyDelay = 1500;
    aiMaxResponseLength = 300;
    aiMaxQuestions = 12;

    readonly AI_TONES = [
        { value: 'professional', label: 'Professional' },
        { value: 'friendly', label: 'Friendly' },
        { value: 'casual', label: 'Casual' },
        { value: 'technical', label: 'Technical' },
    ];

    // ── Email (Resend) ────────────────────────────────────────────────────────
    readonly emailSaving = signal(false);
    readonly emailSaved = signal(false);
    readonly emailError = signal('');

    emailEnabled = false;
    resendApiKey = '';
    emailFromAddress = '';
    emailFromName = 'Mohammad Hamza';

    ngOnInit() {
        this.settingsService.load();
        this.syncFormFromSettings(this.settingsService.settings());
        if (!this.settingsService.loaded()) {
            const poll = setInterval(() => {
                if (this.settingsService.loaded()) {
                    this.syncFormFromSettings(this.settingsService.settings());
                    clearInterval(poll);
                }
            }, 100);
        }
    }

    private syncFormFromSettings(s: AdminSettings) {
        // AI
        this.aiEnabled = s.aiEnabled ?? false;
        this.aiApiKey = s.geminiApiKey ? '••••••••' : '';
        this.aiTone = s.aiTone ?? 'professional';
        this.aiInstruction = s.aiInstruction ?? '';
        this.aiAutoReplyDelay = s.aiAutoReplyDelay ?? 1500;
        this.aiMaxResponseLength = s.aiMaxResponseLength ?? 300;
        this.aiMaxQuestions = s.aiMaxQuestions ?? 12;
        // Email (Resend)
        this.emailEnabled = s.emailEnabled ?? false;
        this.resendApiKey = s.resendApiKey ? '••••••••' : '';
        this.emailFromAddress = s.emailFromAddress ?? '';
        this.emailFromName = s.emailFromName ?? 'Mohammad Hamza';
    }

    private resolveKey(val: string): string | undefined {
        return val && !val.startsWith('••') ? val : undefined;
    }

    saveAiSettings(): void {
        this.aiSaving.set(true);
        this.aiSaved.set(false);
        this.aiError.set('');

        const payload: Partial<AdminSettings> = {
            aiEnabled: this.aiEnabled,
            aiTone: this.aiTone,
            aiInstruction: this.aiInstruction || undefined,
            aiAutoReplyDelay: this.aiAutoReplyDelay,
            aiMaxResponseLength: this.aiMaxResponseLength,
            aiMaxQuestions: this.aiMaxQuestions,
        };
        const resolvedKey = this.resolveKey(this.aiApiKey);
        if (resolvedKey !== undefined) payload['geminiApiKey'] = resolvedKey;

        this.settingsService.update(payload).subscribe({
            next: () => {
                this.aiSaving.set(false);
                this.aiSaved.set(true);
                setTimeout(() => this.aiSaved.set(false), 3000);
            },
            error: (e: any) => {
                this.aiSaving.set(false);
                this.aiError.set(e?.error?.message ?? 'Failed to save AI settings.');
            },
        });
    }

    saveEmailSettings(): void {
        this.emailSaving.set(true);
        this.emailSaved.set(false);
        this.emailError.set('');

        const payload: Partial<AdminSettings> = {
            emailEnabled: this.emailEnabled,
            emailFromAddress: this.emailFromAddress || undefined,
            emailFromName: this.emailFromName || undefined,
        };
        const resolvedKey = this.resolveKey(this.resendApiKey);
        if (resolvedKey !== undefined) payload['resendApiKey'] = resolvedKey;

        this.settingsService.update(payload).subscribe({
            next: () => {
                this.emailSaving.set(false);
                this.emailSaved.set(true);
                setTimeout(() => this.emailSaved.set(false), 3000);
            },
            error: (e: any) => {
                this.emailSaving.set(false);
                this.emailError.set(e?.error?.message ?? 'Failed to save email settings.');
            },
        });
    }
}
