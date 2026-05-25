import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { InquiriesService } from '../../../core/services/inquiry-feedback.service';

const LS_KEY = 'mhf_contact_user';

@Component({
    selector: 'app-contact',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './contact.component.html',
})
export class ContactComponent implements OnInit {
    private service = inject(InquiriesService);
    private route = inject(ActivatedRoute);
    private platformId = inject(PLATFORM_ID);

    readonly sending = signal(false);
    readonly sent = signal(false);
    readonly error = signal('');

    formData = { name: '', email: '', phone: '', subject: '', message: '' };

    ngOnInit() {
        if (isPlatformBrowser(this.platformId)) {
            try {
                const saved = localStorage.getItem(LS_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.formData = { ...this.formData, ...parsed };
                }
            } catch { /* ignore corrupt data */ }
        }

        this.route.queryParams.subscribe(params => {
            if (params['subject']) {
                this.formData = { ...this.formData, subject: params['subject'] };
            }
        });
    }

    submit(form: NgForm) {
        if (form.invalid) return;
        this.sending.set(true);
        this.error.set('');

        const raw = this.formData;
        const payload: Record<string, string> = { name: raw.name, email: raw.email, message: raw.message };
        if (raw.phone?.trim()) payload['phone'] = raw.phone.trim();
        if (raw.subject?.trim()) payload['subject'] = raw.subject.trim();

        this.service.submit(payload).subscribe({
            next: () => {
                if (isPlatformBrowser(this.platformId)) {
                    localStorage.setItem(LS_KEY, JSON.stringify({
                        name: raw.name,
                        email: raw.email,
                        phone: raw.phone,
                    }));
                }
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
