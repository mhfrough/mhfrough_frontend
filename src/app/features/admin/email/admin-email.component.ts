import { Component, OnInit, OnDestroy, inject, signal, computed, HostBinding } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { RteToolbarComponent } from '../../../shared/components/rte-toolbar/rte-toolbar.component';
import { InquiriesService } from '../../../core/services/inquiry-feedback.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { EmailService, EmailMessage } from '../../../core/services/email.service';

type Folder = 'inbox' | 'sent' | 'drafts' | 'inquiries' | 'compose' | 'settings';
type RecipientField = 'to' | 'cc';

interface SavedContact {
    name: string;
    email: string;
}

interface Inquiry {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    subject?: string | null;
    message: string;
    status: string;
    leadId?: string | null;
    createdAt: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface MailMessage {
    id: string;
    from: string;
    fromEmail: string;
    to: string;
    subject: string;
    preview: string;
    body: string;
    date: Date;
    read: boolean;
    starred: boolean;
    folder: 'inbox' | 'sent' | 'drafts' | 'inquiries';
    leadId?: string | null;
    phone?: string | null;
    _sourceId?: string;
}

const DUMMY_MESSAGES: MailMessage[] = [
    {
        id: 'm1', from: 'Ayesha Khan', fromEmail: 'ayesha.khan@example.com', to: 'mhfrough@yahoo.com',
        subject: 'Project inquiry — portfolio redesign',
        preview: 'Hi, I came across your portfolio and would love to discuss a redesign project for our startup…',
        body: 'Hi,\n\nI came across your portfolio and would love to discuss a redesign project for our startup. We are looking for someone who can handle both the frontend and backend.\n\nCould we schedule a call this week?\n\nBest,\nAyesha',
        date: new Date(Date.now() - 1000 * 60 * 22), read: false, starred: true, folder: 'inbox',
    },
    {
        id: 'm2', from: 'GitHub', fromEmail: 'notifications@github.com',
        to: 'mhfrough@yahoo.com', subject: '[mhfrough/portfolio] New star on your repository',
        preview: 'Someone starred mhfrough/portfolio. Keep up the great work!',
        body: 'Someone starred mhfrough/portfolio.\n\nView the repository: github.com/mhfrough/portfolio\n\n— The GitHub Team',
        date: new Date(Date.now() - 1000 * 60 * 60 * 3), read: false, starred: false, folder: 'inbox',
    },
    {
        id: 'm3', from: 'Bilal Ahmed', fromEmail: 'bilal.ahmed@example.com', to: 'mhfrough@yahoo.com',
        subject: 'Re: Invoice #INV-2026-014',
        preview: 'Thanks for sending the invoice over. Payment has been processed and should land in 2-3 business days…',
        body: 'Thanks for sending the invoice over. Payment has been processed and should land in 2-3 business days.\n\nLooking forward to the next milestone.\n\nRegards,\nBilal',
        date: new Date(Date.now() - 1000 * 60 * 60 * 26), read: true, starred: false, folder: 'inbox',
    },
    {
        id: 'm4', from: 'Sara Malik', fromEmail: 'sara.malik@example.com', to: 'mhfrough@yahoo.com',
        subject: 'Feedback on the live chat widget',
        preview: 'The new live chat on your site is really smooth! Quick question about how the AI auto-reply works…',
        body: 'The new live chat on your site is really smooth! Quick question — how does the AI auto-reply decide when to step in versus waiting for you?\n\nCurious because we might want something similar.\n\nThanks,\nSara',
        date: new Date(Date.now() - 1000 * 60 * 60 * 50), read: true, starred: true, folder: 'inbox',
    },
    {
        id: 'm5', from: 'Vercel', fromEmail: 'no-reply@vercel.com', to: 'mhfrough@yahoo.com',
        subject: 'Deployment successful: mhfrough.dev',
        preview: 'Your latest deployment to production succeeded. View the deployment summary and logs…',
        body: 'Your latest deployment to production succeeded.\n\nBranch: main\nCommit: chore: update dependencies\nStatus: Ready\n\nView details in your dashboard.',
        date: new Date(Date.now() - 1000 * 60 * 60 * 80), read: true, starred: false, folder: 'inbox',
    },
];

@Component({
    selector: 'app-admin-email',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule, RouterLink, ConfirmModalComponent, RteToolbarComponent],
    templateUrl: './admin-email.component.html',
    styleUrl: './admin-email.component.scss',
})
export class AdminEmailComponent implements OnInit, OnDestroy {
    @HostBinding('attr.data-bs-theme') readonly darkTheme = 'dark';
    private readonly titleService = inject(Title);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly inquiriesSvc = inject(InquiriesService);
    private readonly emailSvc = inject(EmailService);
    private readonly realtime = inject(RealtimeService);
    readonly notif = inject(AdminNotificationService);

    private subs = new Subscription();

    private static readonly FOLDER_TITLES: Record<Folder, string> = {
        inbox: 'Inbox',
        sent: 'Sent',
        drafts: 'Drafts',
        inquiries: 'Inquiries',
        compose: 'Compose',
        settings: 'Mail Settings',
    };

    readonly menuOpen = signal(false);
    readonly activeFolder = signal<Folder>('inbox');
    readonly searchQuery = signal('');
    readonly selectedId = signal<string | null>(null);

    readonly messages = signal<MailMessage[]>(DUMMY_MESSAGES.map(m => ({ ...m })));

    // ── Inquiries / Sent / Drafts (real data) ───────────────────────────
    readonly inquiries = signal<Inquiry[]>([]);
    readonly inquiriesLoading = signal(true);
    readonly sentMessages = signal<MailMessage[]>([]);
    readonly sentLoading = signal(true);
    readonly draftMessages = signal<MailMessage[]>([]);
    readonly draftsLoading = signal(true);

    // ── Inquiry reply composer ───────────────────────────────────────────
    readonly replySending = signal(false);
    readonly replySent = signal(false);
    readonly replyError = signal('');
    replySubject = '';
    replyBody = '';

    // ── Compose form state ──────────────────────────────────────────────
    readonly showCc = signal(false);
    readonly sending = signal(false);
    readonly sentNotice = signal(false);
    readonly draftSavedNotice = signal(false);
    readonly sendError = signal('');

    // ── Recipient chips (comma-separated addresses → tags) ──────────────
    readonly toEmails = signal<string[]>([]);
    readonly ccEmails = signal<string[]>([]);
    toInputValue = '';
    ccInputValue = '';

    // ── Attachments (drag & drop, same UX as the blog cover-image picker) ─
    readonly attachments = signal<{ name: string; size: number }[]>([]);
    readonly attachmentDragOver = signal(false);

    // ── Saved addresses (short-profile address book) ────────────────────
    readonly savedContacts = signal<SavedContact[]>([
        { name: 'Ayesha', email: 'ayesha.khan@example.com' },
        { name: 'Bilal', email: 'bilal.ahmed@example.com' },
        { name: 'Sara', email: 'sara.malik@example.com' },
    ]);
    readonly savingContactEmail = signal<string | null>(null);
    contactNameInput = '';

    // ── Confirm-delete / confirm-discard modals ─────────────────────────
    readonly deleteTarget = signal<MailMessage | null>(null);
    readonly discardConfirmOpen = signal(false);
    private pendingDiscardForm: NgForm | null = null;

    // ── Settings (dummy, follows admin-login security UX patterns) ──────
    readonly signature = signal('Mohammad Hamza\nFull-stack Developer · mhfrough.dev');
    readonly autoReplyEnabled = signal(false);
    readonly autoReplyMessage = signal('Thanks for your email — I usually reply within 24 hours.');
    readonly twoFactorEnabled = signal(true);
    readonly notifyOnNewMail = signal(true);
    readonly settingsSavedNotice = signal(false);

    // Dummy account-lock style status, mirroring the admin-login lock UI
    readonly lockInfo = signal<{ remainingSeconds: number } | null>(null);
    readonly recentSecurityEvents = [
        { label: 'Signed in from Karachi, PK', time: new Date(Date.now() - 1000 * 60 * 40), kind: 'ok' as const },
        { label: 'Failed sign-in attempt blocked', time: new Date(Date.now() - 1000 * 60 * 60 * 6), kind: 'warn' as const },
        { label: 'App password generated', time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), kind: 'ok' as const },
    ];

    readonly folderCounts = computed(() => {
        const list = this.messages();
        return {
            inbox: list.filter(m => m.folder === 'inbox').length,
            unread: list.filter(m => m.folder === 'inbox' && !m.read).length,
            sent: this.sentMessages().length,
            drafts: this.draftMessages().length,
        };
    });

    private readonly currentFolderMessages = computed<MailMessage[]>(() => {
        switch (this.activeFolder()) {
            case 'inquiries': return this.inquiries().map(inq => this.inquiryToMailMessage(inq));
            case 'sent': return this.sentMessages();
            case 'drafts': return this.draftMessages();
            case 'inbox': return this.messages().filter(m => m.folder === 'inbox');
            default: return [];
        }
    });

    readonly filteredMessages = computed(() => {
        const folder = this.activeFolder();
        if (folder === 'compose' || folder === 'settings') return [];
        const q = this.searchQuery().toLowerCase().trim();
        let list = this.currentFolderMessages();
        if (q) {
            list = list.filter(m =>
                m.from.toLowerCase().includes(q) ||
                m.to.toLowerCase().includes(q) ||
                m.subject.toLowerCase().includes(q) ||
                m.preview.toLowerCase().includes(q)
            );
        }
        return [...list].sort((a, b) => b.date.getTime() - a.date.getTime());
    });

    readonly selectedMessage = computed(() => {
        const id = this.selectedId();
        if (!id) return null;
        return this.currentFolderMessages().find(m => m.id === id) ?? null;
    });

    ngOnInit(): void {
        this.titleService.setTitle('Email | Admin');
        this.loadInquiries();
        this.loadSent();
        this.loadDrafts();

        this.subs.add(this.realtime.on<Inquiry>('inquiry:new').subscribe(inquiry => {
            this.inquiries.update(list => [inquiry, ...list]);
            this.notif.fetchCounts();
        }));

        this.subs.add(this.realtime.on<{ id: string; status: string }>('inquiry:read').subscribe(({ id, status }) => {
            this.inquiries.update(list => list.map(i => i.id === id ? { ...i, status } : i));
            this.notif.fetchCounts();
        }));

        this.subs.add(this.route.queryParamMap.subscribe(params => {
            if (params.get('folder') === 'inquiries' && this.activeFolder() !== 'inquiries') {
                this.goTo('inquiries');
            }
        }));
    }

    ngOnDestroy(): void {
        this.subs.unsubscribe();
    }

    private loadInquiries(): void {
        this.inquiriesLoading.set(true);
        this.inquiriesSvc.getAll().subscribe({
            next: (data: Inquiry[]) => { this.inquiries.set(data); this.inquiriesLoading.set(false); },
            error: () => this.inquiriesLoading.set(false),
        });
    }

    private loadSent(): void {
        this.sentLoading.set(true);
        this.emailSvc.getMessages('sent').subscribe({
            next: (data) => { this.sentMessages.set(data.map(m => this.emailMessageToMailMessage(m))); this.sentLoading.set(false); },
            error: () => this.sentLoading.set(false),
        });
    }

    private loadDrafts(): void {
        this.draftsLoading.set(true);
        this.emailSvc.getMessages('drafts').subscribe({
            next: (data) => { this.draftMessages.set(data.map(m => this.emailMessageToMailMessage(m))); this.draftsLoading.set(false); },
            error: () => this.draftsLoading.set(false),
        });
    }

    private inquiryToMailMessage(inq: Inquiry): MailMessage {
        return {
            id: inq.id,
            from: inq.name,
            fromEmail: inq.email,
            to: '',
            subject: inq.subject || '(no subject)',
            preview: inq.message.slice(0, 120),
            body: inq.message,
            date: new Date(inq.createdAt),
            read: inq.status !== 'new',
            starred: false,
            folder: 'inquiries',
            leadId: inq.leadId ?? null,
            phone: inq.phone ?? null,
            _sourceId: inq.id,
        };
    }

    private emailMessageToMailMessage(m: EmailMessage): MailMessage {
        const text = this.stripHtml(m.body);
        return {
            id: m.id,
            from: 'Mohammad Hamza',
            fromEmail: '',
            to: m.to,
            subject: m.subject || '(no subject)',
            preview: text.slice(0, 120),
            body: m.body,
            date: new Date(m.createdAt),
            read: true,
            starred: false,
            folder: m.folder === 'draft' ? 'drafts' : 'sent',
            _sourceId: m.id,
        };
    }

    private stripHtml(html: string): string {
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    private setTitleFromFolder(): void {
        this.titleService.setTitle(`${AdminEmailComponent.FOLDER_TITLES[this.activeFolder()]} | Admin · Email`);
    }

    toggleMenu() { this.menuOpen.update(v => !v); }
    closeMenu() { this.menuOpen.set(false); }

    goTo(folder: Folder) {
        this.activeFolder.set(folder);
        this.selectedId.set(null);
        this.searchQuery.set('');
        this.sentNotice.set(false);
        this.draftSavedNotice.set(false);
        this.replySent.set(false);
        this.replyError.set('');
        this.menuOpen.set(false);
        this.setTitleFromFolder();
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { folder: folder === 'inquiries' ? 'inquiries' : null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    onSearch(event: Event) {
        this.searchQuery.set((event.target as HTMLInputElement).value);
    }

    openMessage(msg: MailMessage) {
        this.selectedId.set(msg.id);
        this.replySent.set(false);
        this.replyError.set('');

        if (msg.folder === 'inquiries') {
            this.replySubject = msg.subject && msg.subject !== '(no subject)' ? `Re: ${msg.subject}` : 'Re: Your Inquiry';
            this.replyBody = '';
            if (!msg.read && msg._sourceId) {
                const id = msg._sourceId;
                this.inquiriesSvc.markRead(id).subscribe(() => this.notif.fetchCounts());
                this.inquiries.update(list => list.map(i => i.id === id ? { ...i, status: 'read' } : i));
            }
            return;
        }

        if (!msg.read) {
            this.messages.update(list => list.map(m => m.id === msg.id ? { ...m, read: true } : m));
        }
    }

    closeMessage() {
        this.selectedId.set(null);
    }

    sendReply(msg: MailMessage) {
        if (!msg._sourceId || !this.replyBody.trim() || this.replySending()) return;
        this.replySending.set(true);
        this.replyError.set('');
        this.replySent.set(false);
        const subject = this.replySubject.trim() || `Re: ${msg.subject}`;
        const id = msg._sourceId;

        this.inquiriesSvc.reply(id, { subject, html: this.replyBody }).subscribe({
            next: () => {
                this.replySending.set(false);
                this.replySent.set(true);
                this.inquiries.update(list => list.map(i => i.id === id ? { ...i, status: 'replied' } : i));
                this.notif.fetchCounts();
            },
            error: (e: any) => {
                this.replySending.set(false);
                this.replyError.set(e?.error?.message ?? 'Failed to send reply.');
            },
        });
    }

    toggleStar(msg: MailMessage, event: Event) {
        event.stopPropagation();
        this.messages.update(list => list.map(m => m.id === msg.id ? { ...m, starred: !m.starred } : m));
    }

    confirmDeleteMessage(msg: MailMessage, event: Event) {
        event.stopPropagation();
        this.deleteTarget.set(msg);
    }

    cancelDeleteMessage() {
        this.deleteTarget.set(null);
    }

    executeDeleteMessage() {
        const msg = this.deleteTarget();
        if (!msg) return;
        this.deleteTarget.set(null);

        if (msg.folder === 'drafts' && msg._sourceId) {
            this.emailSvc.deleteDraft(msg._sourceId).subscribe();
            this.draftMessages.update(list => list.filter(m => m.id !== msg.id));
        } else if (msg.folder === 'inquiries' && msg._sourceId) {
            const id = msg._sourceId;
            this.inquiriesSvc.remove(id).subscribe(() => this.notif.fetchCounts());
            this.inquiries.update(list => list.filter(i => i.id !== id));
        } else {
            this.messages.update(list => list.filter(m => m.id !== msg.id));
        }

        if (this.selectedId() === msg.id) this.selectedId.set(null);
    }

    // ── Recipient chips (comma-separated addresses → tags) ──────────────
    private recipientsSignal(target: RecipientField) {
        return target === 'to' ? this.toEmails : this.ccEmails;
    }

    addEmails(raw: string, target: RecipientField) {
        const sig = this.recipientsSignal(target);
        const existing = new Set(sig().map(e => e.toLowerCase()));
        const valid = raw.split(',')
            .map(s => s.trim())
            .filter(s => s && EMAIL_RE.test(s) && !existing.has(s.toLowerCase()));

        valid.forEach(e => existing.add(e.toLowerCase()));
        if (valid.length) sig.update(list => [...list, ...valid]);

        if (target === 'to') this.toInputValue = ''; else this.ccInputValue = '';
    }

    removeEmail(email: string, target: RecipientField) {
        this.recipientsSignal(target).update(list => list.filter(e => e !== email));
    }

    pickContact(contact: SavedContact, target: RecipientField) {
        this.addEmails(contact.email, target);
    }

    onEmailInputKeydown(event: KeyboardEvent, target: RecipientField) {
        const value = target === 'to' ? this.toInputValue : this.ccInputValue;
        if ((event.key === 'Enter' || event.key === ',') && value.trim()) {
            event.preventDefault();
            this.addEmails(value, target);
        } else if (event.key === 'Backspace' && !value) {
            this.recipientsSignal(target).update(list => list.slice(0, -1));
        }
    }

    commitEmailInput(target: RecipientField) {
        const value = target === 'to' ? this.toInputValue : this.ccInputValue;
        if (value.trim()) this.addEmails(value, target);
    }

    contactSuggestions(query: string): SavedContact[] {
        const q = query.toLowerCase().trim();
        if (!q) return [];
        return this.savedContacts()
            .filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
            .slice(0, 5);
    }

    // ── Attachments (drag & drop, same UX as the blog cover-image picker) ─
    onAttachmentDragOver(event: DragEvent) { event.preventDefault(); this.attachmentDragOver.set(true); }
    onAttachmentDragLeave() { this.attachmentDragOver.set(false); }

    onAttachmentDrop(event: DragEvent) {
        event.preventDefault();
        this.attachmentDragOver.set(false);
        this.addAttachments(event.dataTransfer?.files ?? null);
    }

    onAttachmentInput(event: Event) {
        const input = event.target as HTMLInputElement;
        this.addAttachments(input.files);
        input.value = '';
    }

    private addAttachments(files: FileList | null) {
        if (!files) return;
        const existing = new Set(this.attachments().map(f => f.name));
        const additions = Array.from(files)
            .filter(f => !existing.has(f.name))
            .map(f => ({ name: f.name, size: f.size }));
        if (additions.length) this.attachments.update(list => [...list, ...additions]);
    }

    removeAttachment(name: string) {
        this.attachments.update(list => list.filter(f => f.name !== name));
    }

    formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    // ── Saved addresses (short-profile address book) ────────────────────
    isSavedContact(email: string): boolean {
        return this.savedContacts().some(c => c.email.toLowerCase() === email.toLowerCase());
    }

    startSaveContact(email: string, event: Event) {
        event.stopPropagation();
        this.savingContactEmail.set(email);
        this.contactNameInput = email.split('@')[0];
    }

    cancelSaveContact() {
        this.savingContactEmail.set(null);
        this.contactNameInput = '';
    }

    confirmSaveContact() {
        const email = this.savingContactEmail();
        const name = this.contactNameInput.trim();
        if (!email || !name) return;
        this.savedContacts.update(list => [...list, { name, email }]);
        this.savingContactEmail.set(null);
        this.contactNameInput = '';
    }

    private resetComposeState() {
        this.toEmails.set([]);
        this.ccEmails.set([]);
        this.toInputValue = '';
        this.ccInputValue = '';
        this.showCc.set(false);
        this.attachments.set([]);
        this.attachmentDragOver.set(false);
    }

    // ── Compose ──────────────────────────────────────────────────────────
    submitCompose(form: NgForm) {
        this.commitEmailInput('to');
        this.commitEmailInput('cc');
        form.form.markAllAsTouched();
        if (form.invalid || this.toEmails().length === 0) return;

        this.sending.set(true);
        this.sentNotice.set(false);
        this.sendError.set('');
        const value = form.value as { subject: string; body: string };

        this.emailSvc.send({
            to: this.toEmails(),
            cc: this.ccEmails().length ? this.ccEmails() : undefined,
            subject: value.subject,
            html: value.body,
        }).subscribe({
            next: (sent) => {
                this.sentMessages.update(list => [this.emailMessageToMailMessage(sent), ...list]);
                this.sending.set(false);
                this.sentNotice.set(true);
                form.resetForm();
                this.resetComposeState();
                setTimeout(() => this.sentNotice.set(false), 4000);
            },
            error: (e: any) => {
                this.sending.set(false);
                this.sendError.set(e?.error?.message ?? 'Failed to send email.');
            },
        });
    }

    saveDraft(form: NgForm) {
        this.commitEmailInput('to');
        this.commitEmailInput('cc');
        const value = form.value as { subject?: string; body?: string };
        if (this.toEmails().length === 0 && !value?.subject && !value?.body) return;

        this.emailSvc.saveDraft({
            to: this.toEmails().length ? this.toEmails() : undefined,
            cc: this.ccEmails().length ? this.ccEmails() : undefined,
            subject: value.subject,
            html: value.body,
        }).subscribe({
            next: (draft) => {
                this.draftMessages.update(list => [this.emailMessageToMailMessage(draft), ...list]);
                this.draftSavedNotice.set(true);
                form.resetForm();
                this.resetComposeState();
                setTimeout(() => this.draftSavedNotice.set(false), 4000);
            },
        });
    }

    confirmDiscard(form: NgForm) {
        this.pendingDiscardForm = form;
        this.discardConfirmOpen.set(true);
    }

    cancelDiscard() {
        this.discardConfirmOpen.set(false);
        this.pendingDiscardForm = null;
    }

    executeDiscard() {
        const form = this.pendingDiscardForm;
        this.discardConfirmOpen.set(false);
        this.pendingDiscardForm = null;
        form?.resetForm();
        this.resetComposeState();
        this.sentNotice.set(false);
        this.draftSavedNotice.set(false);
    }

    // ── Settings (dummy save) ───────────────────────────────────────────
    saveSettings() {
        this.settingsSavedNotice.set(true);
        setTimeout(() => this.settingsSavedNotice.set(false), 3000);
    }

    initials(name: string): string {
        return (name || '?').trim().charAt(0).toUpperCase();
    }
}
