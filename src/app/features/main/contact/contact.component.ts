import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { InquiriesService } from '../../../core/services/inquiry-feedback.service';
import { UserInfoService } from '../../../core/services/user-info.service';
import { RteToolbarComponent } from '../../../shared/components/rte-toolbar/rte-toolbar.component';
import { FooterSettingsService } from '../../../core/services/footer-settings.service';
import { ExternalUrlPipe } from '../../../shared/pipes/external-url.pipe';

@Component({
    selector: 'app-contact',
    standalone: true,
    imports: [CommonModule, FormsModule, RteToolbarComponent, ExternalUrlPipe],
    templateUrl: './contact.component.html',
})
export class ContactComponent implements OnInit {
    private service = inject(InquiriesService);
    private route = inject(ActivatedRoute);
    private platformId = inject(PLATFORM_ID);
    private userInfo = inject(UserInfoService);
    readonly footerSettings = inject(FooterSettingsService);

    isSocialVisible(key: string): boolean {
        const vis = this.footerSettings.data().socialVisibility;
        return vis?.[key]?.['contact'] !== false;
    }

    readonly sending = signal(false);
    readonly sent = signal(false);
    readonly error = signal('');
    readonly dynamicSubject = signal<string | null>(null);

    private readonly knownSubjects = [
        'Project Inquiry', 'Freelance Collaboration', 'Job Opportunity', 'Consulting', 'Just Saying Hello',
    ];

    formData = { name: '', email: '', phone: '', subject: '', message: '' };

    ngOnInit() {
        this.footerSettings.load();
        if (isPlatformBrowser(this.platformId)) {
            const saved = this.userInfo.get();
            if (saved) {
                this.formData = { ...this.formData, ...saved };
            }
        }

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

        const raw = this.formData;
        const payload: Record<string, string> = { name: raw.name, email: raw.email, message: raw.message };
        if (raw.phone?.trim()) payload['phone'] = raw.phone.trim();
        if (raw.subject?.trim()) payload['subject'] = raw.subject.trim();

        this.service.submit(payload).subscribe({
            next: () => {
                this.userInfo.save({ name: raw.name, email: raw.email, phone: raw.phone });
                this.sent.set(true);
                this.sending.set(false);
                this.formData = { ...this.formData, subject: '', message: '' };
                form.resetForm(this.formData);
            },
            error: () => { this.error.set('Something went wrong. Please try again.'); this.sending.set(false); },
        });
    }

    reset(form: NgForm) {
        this.formData = { name: '', email: '', phone: '', subject: '', message: '' };
        form.resetForm(this.formData);
        this.sent.set(false);
        this.error.set('');
    }

    format(el: HTMLTextAreaElement, open: string, close: string): void {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const sel = el.value.substring(start, end);
        const replacement = open + (sel || 'text') + close;
        el.setRangeText(replacement, start, end, 'select');
        el.focus();
        el.dispatchEvent(new Event('input'));
    }
}
