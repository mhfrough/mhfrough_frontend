import { Component, OnInit, inject, signal, computed, HostBinding } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { RteToolbarComponent } from '../../../shared/components/rte-toolbar/rte-toolbar.component';

type Folder = 'inbox' | 'sent' | 'drafts' | 'compose' | 'settings';
type RecipientField = 'to' | 'cc';

interface SavedContact {
    name: string;
    email: string;
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
    folder: 'inbox' | 'sent' | 'drafts';
}

let nextId = 1000;

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
    {
        id: 'm6', from: 'Mohammad Hamza', fromEmail: 'mhfrough@yahoo.com', to: 'ayesha.khan@example.com',
        subject: 'Re: Project inquiry — portfolio redesign',
        preview: 'Thanks for reaching out! I would be glad to help with the redesign. Here is my availability for a call…',
        body: 'Hi Ayesha,\n\nThanks for reaching out! I would be glad to help with the redesign. Here is my availability for a call this week — let me know what works best for you.\n\nBest,\nMohammad',
        date: new Date(Date.now() - 1000 * 60 * 60 * 5), read: true, starred: false, folder: 'sent',
    },
    {
        id: 'm7', from: 'Mohammad Hamza', fromEmail: 'mhfrough@yahoo.com', to: 'bilal.ahmed@example.com',
        subject: 'Invoice #INV-2026-014',
        preview: 'Hi Bilal, please find attached the invoice for the latest milestone. Let me know if you have any questions…',
        body: 'Hi Bilal,\n\nPlease find the invoice for the latest milestone. Let me know if you have any questions.\n\nThanks,\nMohammad',
        date: new Date(Date.now() - 1000 * 60 * 60 * 30), read: true, starred: false, folder: 'sent',
    },
    {
        id: 'm8', from: 'Mohammad Hamza', fromEmail: 'mhfrough@yahoo.com', to: 'sara.malik@example.com',
        subject: 'Re: Feedback on the live chat widget',
        preview: 'Glad you liked it! The AI steps in only when…',
        body: 'Glad you liked it! The AI steps in only after a short delay if I am away, and always hands off to me once I am online.\n\nHappy to share more details if useful.',
        date: new Date(Date.now() - 1000 * 60 * 60 * 48), read: true, starred: false, folder: 'sent',
    },
    {
        id: 'm9', from: 'Mohammad Hamza', fromEmail: 'mhfrough@yahoo.com', to: '',
        subject: 'Follow-up — new portfolio project',
        preview: 'Hey, just checking in on the project brief I sent over last week — wanted to see if you had any…',
        body: 'Hey,\n\nJust checking in on the project brief I sent over last week — wanted to see if you had any questions before we lock in the timeline.\n\n[draft — not yet sent]',
        date: new Date(Date.now() - 1000 * 60 * 60 * 9), read: true, starred: false, folder: 'drafts',
    },
    {
        id: 'm10', from: 'Mohammad Hamza', fromEmail: 'mhfrough@yahoo.com', to: 'team@example.com',
        subject: '(no subject)',
        preview: 'Quick note to self — remember to attach the updated case study deck before sending…',
        body: 'Quick note to self — remember to attach the updated case study deck before sending.\n\n[draft]',
        date: new Date(Date.now() - 1000 * 60 * 60 * 60), read: true, starred: false, folder: 'drafts',
    },
];

@Component({
    selector: 'app-admin-email',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule, ConfirmModalComponent, RteToolbarComponent],
    templateUrl: './admin-email.component.html',
    styleUrl: './admin-email.component.scss',
})
export class AdminEmailComponent implements OnInit {
    @HostBinding('attr.data-bs-theme') readonly darkTheme = 'dark';
    private readonly titleService = inject(Title);

    private static readonly FOLDER_TITLES: Record<Folder, string> = {
        inbox: 'Inbox',
        sent: 'Sent',
        drafts: 'Drafts',
        compose: 'Compose',
        settings: 'Mail Settings',
    };

    readonly menuOpen = signal(false);
    readonly activeFolder = signal<Folder>('inbox');
    readonly searchQuery = signal('');
    readonly selectedId = signal<string | null>(null);

    readonly messages = signal<MailMessage[]>(DUMMY_MESSAGES.map(m => ({ ...m })));

    // ── Compose form state ──────────────────────────────────────────────
    readonly showCc = signal(false);
    readonly sending = signal(false);
    readonly sentNotice = signal(false);
    readonly draftSavedNotice = signal(false);

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
            sent: list.filter(m => m.folder === 'sent').length,
            drafts: list.filter(m => m.folder === 'drafts').length,
        };
    });

    readonly filteredMessages = computed(() => {
        const folder = this.activeFolder();
        if (folder === 'compose' || folder === 'settings') return [];
        const q = this.searchQuery().toLowerCase().trim();
        let list = this.messages().filter(m => m.folder === folder);
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
        return this.messages().find(m => m.id === id) ?? null;
    });

    ngOnInit(): void {
        this.titleService.setTitle('Email | Admin');
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
        this.menuOpen.set(false);
        this.setTitleFromFolder();
    }

    onSearch(event: Event) {
        this.searchQuery.set((event.target as HTMLInputElement).value);
    }

    openMessage(msg: MailMessage) {
        this.selectedId.set(msg.id);
        if (!msg.read) {
            this.messages.update(list => list.map(m => m.id === msg.id ? { ...m, read: true } : m));
        }
    }

    closeMessage() {
        this.selectedId.set(null);
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
        this.messages.update(list => list.filter(m => m.id !== msg.id));
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

    // ── Compose (dummy — no backend) ────────────────────────────────────
    submitCompose(form: NgForm) {
        this.commitEmailInput('to');
        this.commitEmailInput('cc');
        form.form.markAllAsTouched();
        if (form.invalid || this.toEmails().length === 0) return;

        this.sending.set(true);
        this.sentNotice.set(false);
        const value = form.value as { subject: string; body: string };
        const to = this.toEmails().join(', ');

        setTimeout(() => {
            const sentMsg: MailMessage = {
                id: `m${nextId++}`,
                from: 'Mohammad Hamza',
                fromEmail: 'mhfrough@yahoo.com',
                to,
                subject: value.subject || '(no subject)',
                preview: value.body.slice(0, 120),
                body: value.body,
                date: new Date(),
                read: true,
                starred: false,
                folder: 'sent',
            };
            this.messages.update(list => [sentMsg, ...list]);
            this.sending.set(false);
            this.sentNotice.set(true);
            form.resetForm();
            this.resetComposeState();
            setTimeout(() => this.sentNotice.set(false), 4000);
        }, 700);
    }

    saveDraft(form: NgForm) {
        this.commitEmailInput('to');
        this.commitEmailInput('cc');
        const value = form.value as { subject?: string; body?: string };
        const to = this.toEmails().join(', ');
        if (!to && !value?.subject && !value?.body) return;

        const draftMsg: MailMessage = {
            id: `m${nextId++}`,
            from: 'Mohammad Hamza',
            fromEmail: 'mhfrough@yahoo.com',
            to,
            subject: value.subject || '(no subject)',
            preview: (value.body ?? '').slice(0, 120),
            body: value.body ?? '',
            date: new Date(),
            read: true,
            starred: false,
            folder: 'drafts',
        };
        this.messages.update(list => [draftMsg, ...list]);
        this.draftSavedNotice.set(true);
        form.resetForm();
        this.resetComposeState();
        setTimeout(() => this.draftSavedNotice.set(false), 4000);
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
