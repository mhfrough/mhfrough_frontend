import { Component, inject, signal, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription, skip } from 'rxjs';
import { InquiriesService } from '../../../core/services/inquiry-feedback.service';
import { UserInfoService } from '../../../core/services/user-info.service';
import { RteToolbarComponent } from '../../../shared/components/rte-toolbar/rte-toolbar.component';
import { FooterSettingsService } from '../../../core/services/footer-settings.service';
import { EditorHelperService } from '../../../core/services/editor-helper.service';
import { ExternalUrlPipe } from '../../../shared/pipes/external-url.pipe';
import { FrontToastService } from '../../../core/services/front-toast.service';
import { VisitorTrackingService } from '../../../core/services/visitor-tracking.service';
import { NetworkStatusService } from '../../../core/services/network-status.service';
import { SeoService } from '../../../core/services/seo.service';

@Component({
    selector: 'app-contact',
    standalone: true,
    imports: [CommonModule, FormsModule, RteToolbarComponent, ExternalUrlPipe],
    templateUrl: './contact.component.html',
})
export class ContactComponent implements OnInit, OnDestroy {
    private editor = inject(EditorHelperService);
    private service = inject(InquiriesService);
    private route = inject(ActivatedRoute);
    private platformId = inject(PLATFORM_ID);
    private userInfo = inject(UserInfoService);
    readonly footerSettings = inject(FooterSettingsService);
    private toast = inject(FrontToastService);
    private tracking = inject(VisitorTrackingService);
    private seo = inject(SeoService);
    readonly network = inject(NetworkStatusService);

    isSocialVisible(key: string): boolean {
        const vis = this.footerSettings.data().socialVisibility;
        return vis?.[key]?.['contact'] !== false;
    }

    readonly sending = signal(false);
    readonly error = signal('');
    readonly success = signal(false);
    readonly queued = signal(false);
    readonly dynamicSubject = signal<string | null>(null);
    private onlineSub?: Subscription;

    private readonly knownSubjects = [
        'Project Inquiry', 'Freelance Collaboration', 'Job Opportunity', 'Consulting', 'Just Saying Hello',
    ];

    formData = { name: '', email: '', phone: '', subject: '', message: '' };

    ngOnInit() {
        this.seo.update({
            title: 'Contact | Mohammad Hamza',
            description: 'Get in touch with Mohammad Hamza for web design, full-stack development, and product design projects. Available for freelance and consulting work.',
            url: '/contact',
        });
        this.footerSettings.load();
        if (isPlatformBrowser(this.platformId)) {
            const saved = this.userInfo.get();
            if (saved) {
                this.formData = { ...this.formData, ...saved };
            }
        }

        const skipInitial = this.network.isOnline() ? 1 : 0;
        this.onlineSub = this.network.online$.pipe(skip(skipInitial)).subscribe(() => {
            if (this.queued()) {
                this.queued.set(false);
                this.success.set(true);
                if (isPlatformBrowser(this.platformId)) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        });

        this.route.queryParams.subscribe(params => {
            if (params['subject']) {
                this.formData = { ...this.formData, subject: params['subject'] };
                if (!this.knownSubjects.includes(params['subject'])) {
                    this.dynamicSubject.set(params['subject']);
                }
            }
            if (params['message']) {
                this.formData = { ...this.formData, message: params['message'] };
            }
        });
    }

    submit(form: NgForm) {
        form.form.markAllAsTouched();
        if (form.invalid) return;
        this.sending.set(true);
        this.error.set('');
        this.success.set(false);
        this.queued.set(false);

        const raw = this.formData;
        const payload: Record<string, string> = { name: raw.name, email: raw.email, message: raw.message };
        if (raw.phone?.trim()) payload['phone'] = raw.phone.trim();
        if (raw.subject?.trim()) payload['subject'] = raw.subject.trim();

        this.service.submit(payload).subscribe({
            next: (res: any) => {
                this.tracking.trackEvent('contact_submit', { subject: raw.subject || 'none' });
                this.userInfo.save({ name: raw.name, email: raw.email, phone: raw.phone });
                this.sending.set(false);
                this.formData = { ...this.formData, subject: '', message: '' };
                form.resetForm(this.formData);
                if (isPlatformBrowser(this.platformId)) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                if (res?.queued) {
                    this.queued.set(true);
                } else {
                    this.success.set(true);
                }
            },
            error: () => { this.error.set('Something went wrong. Please try again.'); this.sending.set(false); },
        });
    }

    reset(form: NgForm) {
        this.formData = { name: '', email: '', phone: '', subject: '', message: '' };
        form.resetForm(this.formData);
        this.error.set('');
        this.success.set(false);
        this.queued.set(false);
    }

    ngOnDestroy() { this.onlineSub?.unsubscribe(); }

    filterPhoneInput(e: KeyboardEvent) {
        if (e.key.length === 1 && !/[\d+\-\s().]/.test(e.key)) e.preventDefault();
    }

    filterPhonePaste(e: ClipboardEvent) {
        e.preventDefault();
        const clean = (e.clipboardData?.getData('text') ?? '').replace(/[^\d+\-\s().]/g, '').slice(0, 20);
        this.formData.phone = clean;
    }

    format(el: HTMLTextAreaElement, open: string, close: string): void {
        this.editor.format(el, open, close);
    }
}
