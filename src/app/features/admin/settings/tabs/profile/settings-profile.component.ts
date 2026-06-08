import { Component, OnInit, OnDestroy, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSettingsService, AdminProfile, AdminSettings } from '../../../../../core/services/admin-settings.service';
import { FooterSettingsService } from '../../../../../core/services/footer-settings.service';
import { RteToolbarComponent } from '../../../../../shared/components/rte-toolbar/rte-toolbar.component';
import { ImgFallbackDirective } from '../../../../../shared/directives/img-fallback.directive';

@Component({
    selector: 'app-settings-profile',
    standalone: true,
    imports: [CommonModule, FormsModule, RteToolbarComponent, ImgFallbackDirective],
    templateUrl: './settings-profile.component.html',
})
export class SettingsProfileComponent implements OnInit, OnDestroy {
    private readonly settingsService = inject(AdminSettingsService);
    private readonly footerService = inject(FooterSettingsService);

    @ViewChild('aboutEl') aboutEl!: HTMLTextAreaElement;

    readonly profileSaving = signal<'identity' | 'about' | 'links' | null>(null);
    readonly profileSaved = signal<'identity' | 'about' | 'links' | null>(null);
    readonly profileError = signal<{ section: 'identity' | 'about' | 'links'; msg: string } | null>(null);
    readonly avatarUploading = signal(false);
    readonly avatarPreview = signal<string | null>(null);

    profileDisplayName = '';
    profileBio = '';
    profileAboutHtml = '';
    profileTimezone = 'Asia/Karāchi';

    profileLinks: Record<string, string> = {};
    socialVisibility: Record<string, { footer: boolean; contact: boolean }> = {};

    readonly SOCIAL_FIELDS: { key: string; label: string; icon: string; hasFooter: boolean; type?: string; placeholder: string }[] = [
        { key: 'contactEmail', label: 'Email', icon: 'bi-envelope', hasFooter: true, type: 'email', placeholder: 'contact@example.com' },
        { key: 'phone', label: 'Phone', icon: 'bi-telephone', hasFooter: false, type: 'tel', placeholder: '+1 555 000 0000' },
        { key: 'location', label: 'Based in', icon: 'bi-geo-alt', hasFooter: false, placeholder: 'Karāchi, Pakistan' },
        { key: 'website', label: 'Website', icon: 'bi-globe2', hasFooter: true, type: 'url', placeholder: 'https://yoursite.com' },
        { key: 'github', label: 'GitHub', icon: 'bi-github', hasFooter: true, placeholder: 'username or full URL' },
        { key: 'linkedin', label: 'LinkedIn', icon: 'bi-linkedin', hasFooter: true, placeholder: 'username or full URL' },
        { key: 'twitter', label: 'X / Twitter', icon: 'bi-twitter-x', hasFooter: true, placeholder: 'username or full URL' },
        { key: 'instagram', label: 'Instagram', icon: 'bi-instagram', hasFooter: true, placeholder: 'username or full URL' },
        { key: 'youtube', label: 'YouTube', icon: 'bi-youtube', hasFooter: true, placeholder: 'channel URL or handle' },
        { key: 'discord', label: 'Discord', icon: 'bi-discord', hasFooter: true, placeholder: 'invite link or server URL' },
        { key: 'stackoverflow', label: 'Stack Overflow', icon: 'bi-stack-overflow', hasFooter: true, placeholder: 'profile URL' },
        { key: 'medium', label: 'Medium', icon: 'bi-medium', hasFooter: true, placeholder: 'profile URL or @handle' },
        { key: 'dribbble', label: 'Dribbble', icon: 'bi-dribbble', hasFooter: true, placeholder: 'profile URL' },
    ];

    readonly TIMEZONES = [
        'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Karāchi',
        'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo',
        'Australia/Sydney', 'Pacific/Auckland',
    ];

    readonly footerSaved = signal(false);
    readonly footerError = signal('');
    readonly footerLoading = signal(false);
    footerCopyrightOwner = 'mhfrough.dev';
    footerTagline = 'Made with ♥ in Karāchi';
    footerShowTagline = true;
    readonly year = new Date().getFullYear();

    private settingsPoll: ReturnType<typeof setInterval> | null = null;

    ngOnInit() {
        this.settingsService.load();
        this.syncFooterFromSettings(this.settingsService.settings());
        if (!this.settingsService.loaded()) {
            let attempts = 0;
            this.settingsPoll = setInterval(() => {
                attempts++;
                if (this.settingsService.loaded()) {
                    this.syncFooterFromSettings(this.settingsService.settings());
                    this.stopSettingsPoll();
                } else if (attempts >= 50) {
                    this.stopSettingsPoll();
                }
            }, 100);
        }

        const cached = this.settingsService.profile();
        if (cached) {
            this.syncFormFromProfile(cached);
        } else {
            this.settingsService.loadProfile().subscribe({
                next: (p) => this.syncFormFromProfile(p),
                error: () => { },
            });
        }
    }

    private stopSettingsPoll() {
        if (this.settingsPoll !== null) {
            clearInterval(this.settingsPoll);
            this.settingsPoll = null;
        }
    }

    ngOnDestroy() {
        this.stopSettingsPoll();
    }

    private syncFooterFromSettings(s: AdminSettings) {
        this.footerCopyrightOwner = s.copyrightOwner ?? 'mhfrough.dev';
        this.footerTagline = s.footerTagline ?? 'Made with ♥ in Karāchi';
        this.footerShowTagline = s.showFooterTagline ?? true;
    }

    private syncFormFromProfile(p: AdminProfile) {
        this.profileDisplayName = p.displayName ?? '';
        this.profileBio = p.bio ?? '';
        this.profileAboutHtml = p.aboutHtml ?? '';
        this.profileTimezone = p.timezone ?? 'Asia/Karāchi';
        this.profileLinks = {
            contactEmail: p.contactEmail ?? '',
            phone: p.phone ?? '',
            location: p.location ?? '',
            website: p.website ?? '',
            github: p.github ?? '',
            linkedin: p.linkedin ?? '',
            twitter: p.twitter ?? '',
            instagram: p.instagram ?? '',
            youtube: p.youtube ?? '',
            discord: p.discord ?? '',
            stackoverflow: p.stackoverflow ?? '',
            medium: p.medium ?? '',
            dribbble: p.dribbble ?? '',
        };
        this.socialVisibility = p.socialVisibility ?? {};
        if (p.avatarUrl) this.avatarPreview.set(p.avatarUrl);
    }

    getSocialVis(key: string, place: 'footer' | 'contact'): boolean {
        return this.socialVisibility[key]?.[place] !== false;
    }

    setSocialVis(key: string, place: 'footer' | 'contact', val: boolean) {
        const cur = this.socialVisibility[key] ?? { footer: true, contact: true };
        this.socialVisibility = { ...this.socialVisibility, [key]: { ...cur, [place]: val } };
    }

    get profileInitials(): string {
        const name = this.profileDisplayName || this.settingsService.profile()?.email || 'A';
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    }

    onAvatarSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => this.avatarPreview.set(e.target?.result as string);
        reader.readAsDataURL(file);
        this.avatarUploading.set(true);
        this.settingsService.uploadAvatar(file).subscribe({
            next: (res) => {
                this.avatarUploading.set(false);
                this.avatarPreview.set(res.url);
                this.settingsService.updateProfile({ avatarUrl: res.url }).subscribe();
            },
            error: () => {
                this.avatarUploading.set(false);
                this.profileError.set({ section: 'identity', msg: 'Avatar upload failed. Please try again.' });
            },
        });
        input.value = '';
    }

    saveProfile(section: 'identity' | 'about' | 'links') {
        this.profileSaving.set(section);
        this.profileSaved.set(null);
        this.profileError.set(null);
        this.settingsService.updateProfile({
            displayName: this.profileDisplayName || undefined,
            bio: this.profileBio || undefined,
            aboutHtml: this.profileAboutHtml || undefined,
            timezone: this.profileTimezone || undefined,
            contactEmail: this.profileLinks['contactEmail'] || undefined,
            phone: this.profileLinks['phone'] || undefined,
            location: this.profileLinks['location'] || undefined,
            website: this.profileLinks['website'] || undefined,
            github: this.profileLinks['github'] || undefined,
            linkedin: this.profileLinks['linkedin'] || undefined,
            twitter: this.profileLinks['twitter'] || undefined,
            instagram: this.profileLinks['instagram'] || undefined,
            youtube: this.profileLinks['youtube'] || undefined,
            discord: this.profileLinks['discord'] || undefined,
            stackoverflow: this.profileLinks['stackoverflow'] || undefined,
            medium: this.profileLinks['medium'] || undefined,
            dribbble: this.profileLinks['dribbble'] || undefined,
            socialVisibility: this.socialVisibility,
        }).subscribe({
            next: () => {
                this.profileSaving.set(null);
                this.profileSaved.set(section);
                this.footerService.load();
                setTimeout(() => this.profileSaved.set(null), 3000);
            },
            error: (e) => {
                this.profileSaving.set(null);
                this.profileError.set({ section, msg: e?.error?.message ?? 'Failed to save profile.' });
            },
        });
    }

    saveFooterBranding() {
        this.footerLoading.set(true);
        this.footerSaved.set(false);
        this.footerError.set('');
        this.settingsService.update({
            copyrightOwner: this.footerCopyrightOwner,
            footerTagline: this.footerTagline,
            showFooterTagline: this.footerShowTagline,
        }).subscribe({
            next: () => {
                this.footerLoading.set(false);
                this.footerSaved.set(true);
                this.footerService.load();
                setTimeout(() => this.footerSaved.set(false), 3000);
            },
            error: (e) => {
                this.footerLoading.set(false);
                this.footerError.set(e?.error?.message ?? 'Failed to save footer settings.');
            },
        });
    }
}
