import {
    Component, OnInit, OnDestroy, inject, signal, computed, PLATFORM_ID,
    ViewChild, ElementRef, effect, untracked, afterRenderEffect, NgZone, Injector, HostListener,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Subscription } from 'rxjs';
import { ChatService, ChatSession, ChatMessage, VisitorActivity } from '../../../core/services/chat.service';
import { LeadsService, CreateLeadPayload } from '../../../core/services/leads.service';
import { ActivityLogService } from '../../../core/services/activity-log.service';
import { SoundService } from '../../../core/services/sound.service';
import { VisitorAnalyticsService, VisitorSession } from '../../../core/services/visitor-analytics.service';
import { RteToolbarComponent } from '../../../shared/components/rte-toolbar/rte-toolbar.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { formatDuration, lightboxCaption } from '../../../shared/chat-widget/chat-message.utils';

export interface PendingFile {
    file: File;
    previewUrl: string | null;
    uploading: boolean;
    done: boolean;
    error: boolean;
}

@Component({
    selector: 'app-admin-chat',
    standalone: true,
    imports: [CommonModule, FormsModule, RteToolbarComponent, ImgFallbackDirective],
    templateUrl: './admin-chat.component.html',
    styleUrl: './admin-chat.component.scss',
})
export class AdminChatComponent implements OnInit, OnDestroy {
    private readonly chatService = inject(ChatService);
    private readonly leads = inject(LeadsService);
    private readonly visitorAnalytics = inject(VisitorAnalyticsService);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly errLog = inject(ActivityLogService);
    private readonly sound = inject(SoundService);
    private readonly zone = inject(NgZone);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly injector = inject(Injector);

    @ViewChild('msgsEl') msgsEl!: ElementRef<HTMLDivElement>;
    @ViewChild('sessionListEl') sessionListEl!: ElementRef<HTMLUListElement>;
    @ViewChild('fileInputEl') fileInputEl!: ElementRef<HTMLInputElement>;
    @ViewChild('editorEl') editorEl!: ElementRef<HTMLTextAreaElement>;

    readonly sessions = this.chatService.sessions;
    readonly activeMsgs = this.chatService.activeMsgs;
    readonly activeSessionId = this.chatService.activeSessionId;
    readonly visitorTyping = this.chatService.visitorTyping;
    readonly settings = this.chatService.settings;
    readonly currentPageMap = this.chatService.currentPageMap;
    readonly activityLog = this.chatService.activityLog;

    readonly activeVisitorSession = signal<VisitorSession | null>(null);
    readonly visitorInfoOpen = signal(false);

    activeTab: 'chat' | 'settings' = 'chat';
    messageText = '';

    // ─── Rich text editor ─────────────────────────────────────────────────────
    readonly editorHasContent = signal(false);

    // ─── Session notes ────────────────────────────────────────────────────────
    readonly notesText = signal('');
    readonly notesSaved = signal(false);
    private _notesSaveTimeout?: ReturnType<typeof setTimeout>;

    // ─── Create Lead ──────────────────────────────────────────────────────────
    readonly showLeadModal = signal(false);
    readonly leadFormSaving = signal(false);
    readonly leadFormError = signal('');
    leadForm = { name: '', email: '', phone: '', projectSummary: '' };

    // ─── Audio recording ──────────────────────────────────────────────────────
    readonly isRecording = signal(false);
    readonly isUploadingAudio = signal(false);
    readonly recordingSeconds = signal(0);
    readonly waveformBars = signal<number[]>(Array(28).fill(0));

    private mediaRecorder?: MediaRecorder;
    private audioChunks: Blob[] = [];
    private audioContext?: AudioContext;
    private analyser?: AnalyserNode;
    private waveformInterval?: ReturnType<typeof setInterval>;
    private recordingInterval?: ReturnType<typeof setInterval>;

    // ─── Audio playback ───────────────────────────────────────────────────────
    readonly playingAudioId = signal<string | null>(null);
    readonly audioProgress = signal<Record<string, number>>({});
    readonly audioDurations = signal<Record<string, number>>({});
    private audioEls = new Map<string, HTMLAudioElement>();
    private _audioBarsCache = new Map<string, number[]>();
    private _rafId: number | null = null;

    // ─── File upload ──────────────────────────────────────────────────────────
    readonly pendingFiles = signal<PendingFile[]>([]);
    readonly isDragOver = signal(false);
    readonly isSendingFiles = signal(false);

    // send button shows when text OR files are pending
    readonly canSend = computed(() => this.editorHasContent() || this.pendingFiles().length > 0);

    // ─── Lightbox ─────────────────────────────────────────────────────────────
    readonly lightboxIndex = signal<number>(-1);

    readonly lightboxImgs = computed(() =>
        this.activeMsgs().filter(m => m.messageType === 'file' && m.fileUrl && this.isImage(m.fileType))
    );

    readonly lightboxMsg = computed(() => {
        const idx = this.lightboxIndex();
        const imgs = this.lightboxImgs();
        return idx >= 0 && idx < imgs.length ? imgs[idx] : null;
    });

    // ─── Notes expand ─────────────────────────────────────────────────────────
    readonly notesExpanded = signal(false);

    readonly deleteTargetId = signal<string | null>(null);
    readonly closeTargetId = signal<string | null>(null);

    // Chat sidebar search
    readonly sessionSearch = signal('');

    readonly filteredSessions = computed(() => {
        const q = this.sessionSearch().toLowerCase().trim();
        if (!q) return this.sessions();
        return this.sessions().filter(s =>
            s.visitorName?.toLowerCase().includes(q)
        );
    });

    onSessionSearch(e: Event) {
        this.sessionSearch.set((e.target as HTMLInputElement).value);
    }

    // Settings form
    greetingMessages: string[] = [];
    holdMessages: string[] = [];
    statusMessage = '';
    readonly settingsSaved = signal(false);
    readonly settingsError = signal<string | null>(null);
    readonly settingsSaving = signal(false);

    private typingTimeout?: ReturnType<typeof setTimeout>;
    private _subs = new Subscription();
    private _shouldScroll = signal(false);
    private _shouldScrollSidebar = signal(false);
    private _prevActiveMsgsCount = -1;
    private _prevSessionsCount = -1;
    private _titleBlinkInterval?: ReturnType<typeof setInterval>;
    private _titleBlinkLabel = '';
    private _originalTitle = '';

    constructor() {
        // Scroll when active messages change
        effect(() => {
            this.activeMsgs(); // track dependency
            untracked(() => { this._shouldScroll.set(true); });
        });

        // Sound + title blink when new visitor message arrives in the active session
        effect(() => {
            const msgs = this.activeMsgs();
            untracked(() => {
                if (this._prevActiveMsgsCount >= 0) {
                    const newFromVisitor = msgs.slice(this._prevActiveMsgsCount).filter(m => m.sender === 'visitor');
                    if (newFromVisitor.length > 0 && isPlatformBrowser(this.platformId)) {
                        this.sound.play('notification');
                        // Title managed by unreadChatCount effect below
                    }
                }
                this._prevActiveMsgsCount = msgs.length;
            });
        });

        // Sound when a brand-new chat session arrives
        effect(() => {
            const sessions = this.sessions();
            untracked(() => {
                if (this._prevSessionsCount >= 0 && sessions.length > this._prevSessionsCount
                    && isPlatformBrowser(this.platformId)) {
                    this.sound.play('notification');
                    // Title managed by unreadChatCount effect below
                }
                this._prevSessionsCount = sessions.length;
            });
        });

        // Title blink driven by total unread count across all sessions
        effect(() => {
            const count = this.chatService.unreadChatCount();
            untracked(() => {
                if (!isPlatformBrowser(this.platformId)) return;
                if (count > 0) {
                    this._startTitleBlink(`💬 (${count}) New Message`);
                } else {
                    this._stopTitleBlink();
                }
            });
        });

        // Scroll when visitor typing indicator appears
        effect(() => {
            const typingData = this.visitorTyping();
            untracked(() => {
                const sessionId = this.activeSessionId();
                const isTyping = !!(typingData && typingData.sessionId === sessionId && typingData.isTyping);
                if (isTyping) this._shouldScroll.set(true);
            });
        });

        // Eagerly preload audio metadata for any audio messages
        effect(() => {
            const msgs = this.activeMsgs();
            untracked(() => {
                if (!isPlatformBrowser(this.platformId)) return;
                msgs.filter(m => m.messageType === 'audio' && m.audioUrl)
                    .forEach(m => this.getOrCreateAudioEl(m.id, m.audioUrl!));
            });
        });

        // Perform the actual scroll after Angular has committed DOM updates
        afterRenderEffect(() => {
            if (this._shouldScroll()) {
                untracked(() => {
                    this._shouldScroll.set(false);
                    const el = this.msgsEl?.nativeElement;
                    if (el) el.scrollTop = el.scrollHeight;
                });
            }
            if (this._shouldScrollSidebar()) {
                untracked(() => {
                    this._shouldScrollSidebar.set(false);
                    const list = this.sessionListEl?.nativeElement;
                    const active = list?.querySelector<HTMLElement>('.is-active');
                    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                });
            }
        });
    }

    ngOnInit() {
        this.chatService.loadSettings();

        // Restore active session from URL query param once sessions are loaded
        const targetId = this.route.snapshot.queryParamMap.get('s');
        if (targetId) {
            // Sessions may not be loaded yet — wait until the list arrives
            const unsub = effect(() => {
                const sessions = this.sessions();
                if (sessions.length === 0) return;
                untracked(() => {
                    const match = sessions.find(s => s.id === targetId);
                    if (match) {
                        this.selectSession(match);
                        this._shouldScrollSidebar.set(true);
                    }
                    unsub.destroy();
                });
            }, { injector: this.injector });
        }
    }

    ngOnDestroy() {
        this._subs.unsubscribe();
        // socket managed by AdminLayoutComponent
        this._stopTitleBlink();
        this._stopScrubberLoop();
        this._cleanupRecording();
        this.audioEls.forEach(el => { el.pause(); el.src = ''; });
        this.audioEls.clear();
        this.clearPendingFiles();
        clearTimeout(this._notesSaveTimeout);
    }

    selectSession(session: ChatSession) {
        this.chatService.selectSession(session.id);
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { s: session.id },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
        this._shouldScrollSidebar.set(true);
        this.activeVisitorSession.set(null);
        // Load notes for this session
        this.notesText.set(session.notes ?? '');
        clearTimeout(this._notesSaveTimeout);
        if (session.visitorSessionId) {
            this.visitorAnalytics.getSession(session.visitorSessionId).subscribe({
                next: (vs) => this.activeVisitorSession.set(vs),
                error: () => { },
            });
        }
    }

    onNotesInput(value: string) {
        this.notesText.set(value);
        clearTimeout(this._notesSaveTimeout);
        this._notesSaveTimeout = setTimeout(() => this.saveNotes(), 1200);
    }

    saveNotes() {
        const sessionId = this.activeSessionId();
        if (!sessionId) return;
        this.chatService.updateSessionNotes(sessionId, this.notesText()).subscribe({
            next: () => {
                this.chatService.sessions.update(list =>
                    list.map(s => s.id === sessionId ? { ...s, notes: this.notesText() } : s)
                );
                this.notesSaved.set(true);
                setTimeout(() => this.notesSaved.set(false), 2000);
            },
        });
    }

    private notesLeaveTimer: ReturnType<typeof setTimeout> | null = null;

    onNotesFocus() {
        if (this.notesLeaveTimer) { clearTimeout(this.notesLeaveTimer); this.notesLeaveTimer = null; }
        this.notesExpanded.set(true);
    }

    onNotesBlur() {
        this.notesLeaveTimer = setTimeout(() => {
            this.saveNotes();
            this.notesExpanded.set(false);
            this.notesLeaveTimer = null;
        }, 400);
    }

    getActiveVisitorCurrentPage(): string | null {
        const vsId = this.getActiveSession()?.visitorSessionId;
        if (!vsId) return null;
        return this.currentPageMap()[vsId] ?? null;
    }

    getActiveVisitorActivity(): VisitorActivity[] {
        const vsId = this.getActiveSession()?.visitorSessionId;
        if (!vsId) return [];
        return this.activityLog()[vsId] ?? [];
    }

    formatActivityTime(ts: string): string {
        const d = new Date(ts);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }

    formatEventLabel(label: string): string {
        return label.replace(/_/g, ' ');
    }

    sendMessage() {
        const el = this.editorEl?.nativeElement;
        if (!el) return;
        const sessionId = this.activeSessionId();
        if (!sessionId) return;

        const html = el.value.trim();
        const files = this.pendingFiles();

        if (files.length > 0) {
            if (this.isSendingFiles()) return;
            this.isSendingFiles.set(true);
            const rawFiles = files.map(f => f.file);
            const caption = html;
            this.chatService.uploadAdminFiles(rawFiles, sessionId).subscribe({
                next: (results) => {
                    for (const r of results) {
                        this.chatService.sendAdminFileMessage(sessionId, r.url, r.name, r.type, r.size, caption);
                    }
                    for (const pf of files) { if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl); }
                    this.pendingFiles.set([]);
                    el.value = '';
                    this.editorHasContent.set(false);
                    this.isSendingFiles.set(false);
                },
                error: (err) => {
                    this.isSendingFiles.set(false);
                    this.errLog.reportClientError(err?.message ?? 'Upload failed', err?.stack, 'admin-chat:sendMessage').subscribe();
                },
            });
            return;
        }

        if (!html) return;
        this.chatService.sendAdminMessage(sessionId, html);
        el.value = '';
        this.editorHasContent.set(false);
    }

    @HostListener('document:keydown', ['$event'])
    onGlobalKeydown(event: KeyboardEvent) {
        if (this.lightboxIndex() >= 0) {
            if (event.key === 'Escape') { this.closeLightbox(); return; }
            if (event.key === 'ArrowLeft') { this.lightboxPrev(); return; }
            if (event.key === 'ArrowRight') { this.lightboxNext(); return; }
        }
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    onEditorInput() {
        const el = this.editorEl?.nativeElement;
        if (!el) return;
        this.editorHasContent.set(el.value.trim() !== '');
        const sessionId = this.activeSessionId();
        if (!sessionId) return;
        this.chatService.sendAdminTyping(sessionId, true);
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.chatService.sendAdminTyping(sessionId, false), 1500);
    }

    onInput() {
        this.onEditorInput();
    }

    closeSession(sessionId?: string) {
        const id = sessionId ?? this.activeSessionId();
        if (id) this.closeTargetId.set(id);
    }

    cancelClose() { this.closeTargetId.set(null); }

    executeClose() {
        const id = this.closeTargetId();
        if (!id) return;
        this.closeTargetId.set(null);
        this.chatService.closeSession(id);
    }

    confirmDelete(sessionId: string, event: Event) {
        event.stopPropagation();
        this.deleteTargetId.set(sessionId);
    }

    cancelDelete() { this.deleteTargetId.set(null); }

    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.chatService.deleteSession(id).subscribe(() => {
            // Optimistic removal — session:deleted socket event will confirm for other tabs
            this.chatService.sessions.update(list => list.filter(s => s.id !== id));
            if (this.activeSessionId() === id) {
                this.chatService.activeSessionId.set(null);
                this.chatService.activeMsgs.set([]);
                this._clearSessionUrl();
            }
        });
    }

    private _clearSessionUrl() {
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { s: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    deleteSession(sessionId: string, event: Event) {
        this.confirmDelete(sessionId, event);
    }

    isVisitorTyping(): boolean {
        const t = this.visitorTyping();
        return !!(t && t.sessionId === this.activeSessionId() && t.isTyping);
    }

    getActiveSession(): ChatSession | undefined {
        return this.sessions().find(s => s.id === this.activeSessionId());
    }

    toggleBot() {
        const session = this.getActiveSession();
        if (!session) return;
        const next = !(session.botEnabled ?? true);
        this.chatService.toggleSessionBot(session.id, next);
    }

    // ─── Create Lead ──────────────────────────────────────────────────────────
    openCreateLeadModal() {
        const session = this.getActiveSession();
        this.leadForm = { name: session?.visitorName ?? '', email: '', phone: '', projectSummary: '' };
        this.leadFormError.set('');
        this.showLeadModal.set(true);
    }

    closeLeadModal() {
        this.showLeadModal.set(false);
    }

    saveLead() {
        const session = this.getActiveSession();
        if (!session) return;
        if (!this.leadForm.name.trim() || !this.leadForm.email.trim()) {
            this.leadFormError.set('Name and email are required.');
            return;
        }
        this.leadFormSaving.set(true);
        const payload: CreateLeadPayload = {
            name: this.leadForm.name.trim(),
            email: this.leadForm.email.trim(),
            phone: this.leadForm.phone.trim() || undefined,
            projectSummary: this.leadForm.projectSummary.trim() || undefined,
            source: 'chat',
            chatSessionId: session.id,
        };
        this.leads.create(payload).subscribe({
            next: (lead) => {
                this.leadFormSaving.set(false);
                this.chatService.sessions.update(list =>
                    list.map(s => s.id === session.id ? { ...s, leadId: lead.id } : s)
                );
                this.showLeadModal.set(false);
            },
            error: () => {
                this.leadFormSaving.set(false);
                this.leadFormError.set('Failed to create lead. Please try again.');
            },
        });
    }

    goToLead() {
        const leadId = this.getActiveSession()?.leadId;
        if (leadId) this.router.navigate(['/admin/leads', leadId]);
    }

    // ─── Settings tab ─────────────────────────────────────────────────────────

    openSettings() {
        this.activeTab = 'settings';
        const s = this.settings();
        this.greetingMessages = s ? [...s.greeting_messages] : [];
        this.holdMessages = s ? [...s.hold_messages] : [];
        this.statusMessage = s?.status_message ?? '';
    }

    addGreeting() { this.greetingMessages.push(''); }
    removeGreeting(i: number) { this.greetingMessages.splice(i, 1); }
    addHold() { this.holdMessages.push(''); }
    removeHold(i: number) { this.holdMessages.splice(i, 1); }

    trackIdx(i: number) { return i; }

    saveSettings() {
        if (this.settingsSaving()) return;
        this.settingsSaving.set(true);
        this.settingsSaved.set(false);
        this.settingsError.set(null);

        forkJoin([
            this.chatService.saveSettings('greeting_messages', this.greetingMessages.filter(m => m.trim())),
            this.chatService.saveSettings('hold_messages', this.holdMessages.filter(m => m.trim())),
            this.chatService.saveSettings('status_message', this.statusMessage),
        ]).subscribe({
            next: () => {
                this.chatService.loadSettings();
                this.settingsSaving.set(false);
                this.settingsSaved.set(true);
                setTimeout(() => this.settingsSaved.set(false), 3000);
            },
            error: (e) => {
                this.settingsSaving.set(false);
                this.settingsError.set(e?.error?.message ?? 'Failed to save settings. Please try again.');
                setTimeout(() => this.settingsError.set(null), 4000);
            },
        });
    }

    trackById(_: number, m: { id: string }) { return m.id; }
    trackBySessionId(_: number, s: ChatSession) { return s.id; }

    // ─── File upload & drag-drop ──────────────────────────────────────────────

    openFilePicker() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.fileInputEl?.nativeElement.click();
    }

    onFileInputChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files?.length) {
            this.handleFiles(Array.from(input.files));
            input.value = '';
        }
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        this.isDragOver.set(true);
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver.set(false);
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver.set(false);
        const files = event.dataTransfer?.files;
        if (files?.length) this.handleFiles(Array.from(files));
    }

    handleFiles(files: File[]) {
        const ALLOWED = /^(image\/|video\/|audio\/|application\/pdf|application\/msword|application\/vnd\.|text\/plain|application\/zip)/;
        const MAX = 25 * 1024 * 1024;
        const valid = files.filter(f => ALLOWED.test(f.type) && f.size <= MAX);
        if (!valid.length) return;

        const items: PendingFile[] = valid.map(f => ({
            file: f,
            previewUrl: (f.type.startsWith('image/') || f.type.startsWith('video/')) ? URL.createObjectURL(f) : null,
            uploading: false,
            done: false,
            error: false,
        }));
        this.pendingFiles.update(list => [...list, ...items]);
    }

    removePendingFile(index: number) {
        this.pendingFiles.update(list => {
            const copy = [...list];
            const removed = copy.splice(index, 1)[0];
            if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return copy;
        });
    }

    sendPendingFiles() {
        const sessionId = this.activeSessionId();
        const files = this.pendingFiles();
        if (!sessionId || !files.length || this.isSendingFiles()) return;

        this.isSendingFiles.set(true);
        const rawFiles = files.map(f => f.file);

        this.chatService.uploadAdminFiles(rawFiles, sessionId).subscribe({
            next: (results) => {
                for (const r of results) {
                    this.chatService.sendAdminFileMessage(sessionId, r.url, r.name, r.type, r.size);
                }
                // revoke object URLs
                for (const pf of files) {
                    if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
                }
                this.pendingFiles.set([]);
                this.isSendingFiles.set(false);
            },
            error: (err) => {
                this.isSendingFiles.set(false);
                this.errLog.reportClientError(
                    err?.message ?? 'File upload failed',
                    err?.stack,
                    'admin-chat:sendPendingFiles',
                ).subscribe();
            },
        });
    }

    clearPendingFiles() {
        for (const pf of this.pendingFiles()) {
            if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
        }
        this.pendingFiles.set([]);
    }

    // ─── Lightbox ─────────────────────────────────────────────────────────────

    readonly lbZoom = signal(1);
    lbZoomIn()    { this.lbZoom.update(z => Math.min(z + 0.5, 3)); }
    lbZoomOut()   { this.lbZoom.update(z => Math.max(z - 0.5, 0.5)); }
    lbZoomReset() { this.lbZoom.set(1); }

    openLightbox(msgId: string) {
        const idx = this.lightboxImgs().findIndex(m => m.id === msgId);
        if (idx >= 0) { this.lightboxIndex.set(idx); this.lbZoom.set(1); }
    }

    closeLightbox() { this.lightboxIndex.set(-1); this.lbZoom.set(1); }

    lightboxNext() {
        const max = this.lightboxImgs().length - 1;
        this.lightboxIndex.update(i => i < max ? i + 1 : 0);
        this.lbZoom.set(1);
    }

    lightboxPrev() {
        const max = this.lightboxImgs().length - 1;
        this.lightboxIndex.update(i => i > 0 ? i - 1 : max);
        this.lbZoom.set(1);
    }

    lightboxCaption(msg: ChatMessage | null): string {
        return lightboxCaption(msg);
    }

    // ─── File helpers ─────────────────────────────────────────────────────────

    isImage(type: string | null | undefined): boolean {
        return !!type?.startsWith('image/');
    }

    isVideo(type: string | null | undefined): boolean {
        return !!type?.startsWith('video/');
    }

    fileIcon(type: string | null | undefined): string {
        if (!type) return 'bi-file-earmark';
        if (type.startsWith('image/')) return 'bi-file-earmark-image';
        if (type.startsWith('video/')) return 'bi-file-earmark-play';
        if (type.startsWith('audio/')) return 'bi-file-earmark-music';
        if (type === 'application/pdf') return 'bi-file-earmark-pdf';
        if (type.includes('word') || type.includes('document')) return 'bi-file-earmark-word';
        if (type.includes('sheet') || type.includes('excel')) return 'bi-file-earmark-spreadsheet';
        if (type.includes('zip') || type.includes('archive')) return 'bi-file-earmark-zip';
        if (type.startsWith('text/')) return 'bi-file-earmark-text';
        return 'bi-file-earmark';
    }

    formatFileSize(bytes: number | null | undefined): string {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    // ─── Title blink ──────────────────────────────────────────────────────────

    private _startTitleBlink(label: string): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this._titleBlinkLabel = label; // Update label even if already blinking
        if (this._titleBlinkInterval) return;
        this._originalTitle = document.title;
        let blink = false;
        this._titleBlinkInterval = setInterval(() => {
            document.title = blink ? this._titleBlinkLabel : this._originalTitle;
            blink = !blink;
        }, 1000);
    }

    private _stopTitleBlink(): void {
        if (this._titleBlinkInterval) {
            clearInterval(this._titleBlinkInterval);
            this._titleBlinkInterval = undefined;
        }
        if (isPlatformBrowser(this.platformId) && this._originalTitle) {
            document.title = this._originalTitle;
        }
    }

    // ─── Audio recording ──────────────────────────────────────────────────────

    async startRecording() {
        if (!isPlatformBrowser(this.platformId)) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioChunks = [];

            this.audioContext = new AudioContext();
            const source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64;
            source.connect(this.analyser);

            const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
                .find(t => MediaRecorder.isTypeSupported(t)) ?? '';
            this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.audioChunks.push(e.data);
            };
            this.mediaRecorder.start(100);

            this.isRecording.set(true);
            this.recordingSeconds.set(0);

            this.recordingInterval = setInterval(() => {
                this.recordingSeconds.update(s => s + 1);
            }, 1000);

            this.waveformInterval = setInterval(() => {
                if (!this.analyser) return;
                const data = new Uint8Array(this.analyser.frequencyBinCount);
                this.analyser.getByteFrequencyData(data);
                const bars = Array.from({ length: 28 }, (_, i) => {
                    const idx = Math.floor(i * data.length / 28);
                    return data[idx] / 255;
                });
                this.waveformBars.set(bars);
            }, 80);

        } catch (err) {
            this.errLog.reportClientError(
                (err as Error).message,
                (err as Error).stack,
                'admin-chat:startRecording',
            ).subscribe();
        }
    }

    stopAndSend() {
        const sessionId = this.activeSessionId();
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive' || !sessionId) return;
        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
            this._cleanupRecording();
            this.isRecording.set(false);
            this.recordingSeconds.set(0);
            this.waveformBars.set(Array(28).fill(0));
            this.isUploadingAudio.set(true);

            this.chatService.uploadChatAudio(blob).subscribe({
                next: ({ url }) => {
                    this.chatService.sendAdminAudioMessage(sessionId, url);
                    this.isUploadingAudio.set(false);
                },
                error: (err) => {
                    this.isUploadingAudio.set(false);
                    this.errLog.reportClientError(
                        err?.message ?? 'Audio upload failed',
                        err?.stack,
                        'admin-chat:stopAndSend',
                    ).subscribe();
                },
            });
        };
        this.mediaRecorder.stop();
    }

    deleteRecording() {
        if (this.mediaRecorder) {
            this.mediaRecorder.ondataavailable = null;
            this.mediaRecorder.onstop = null;
        }
        this._cleanupRecording();
        this.isRecording.set(false);
        this.recordingSeconds.set(0);
        this.waveformBars.set(Array(28).fill(0));
        this.audioChunks = [];
    }

    private _cleanupRecording() {
        clearInterval(this.waveformInterval);
        clearInterval(this.recordingInterval);
        this.mediaRecorder?.stream.getTracks().forEach(t => t.stop());
        this.audioContext?.close().catch(() => { /* no-op */ });
        this.mediaRecorder = undefined;
        this.audioContext = undefined;
        this.analyser = undefined;
        this.waveformInterval = undefined;
        this.recordingInterval = undefined;
    }

    formatDuration(seconds: number): string {
        return formatDuration(seconds);
    }

    // ─── Audio playback ───────────────────────────────────────────────────────

    private getOrCreateAudioEl(msgId: string, src: string): HTMLAudioElement {
        if (!this.audioEls.has(msgId)) {
            const el = new Audio(src);
            el.preload = 'metadata';
            const setDuration = () => {
                if (isFinite(el.duration) && el.duration > 0) {
                    this.zone.run(() => this.audioDurations.update(d => ({ ...d, [msgId]: el.duration })));
                }
            };
            el.addEventListener('loadedmetadata', setDuration);
            el.addEventListener('durationchange', setDuration);
            el.addEventListener('timeupdate', () => {
                this.zone.run(() => this.audioProgress.update(p => ({ ...p, [msgId]: el.currentTime })));
            });
            el.addEventListener('ended', () => {
                this.zone.run(() => {
                    this._stopScrubberLoop();
                    const dur = isFinite(el.duration) ? el.duration : el.currentTime;
                    this.audioProgress.update(p => ({ ...p, [msgId]: dur }));
                    // Snap range DOM to end directly (no [value] binding to rely on)
                    const rangeEl = document.querySelector<HTMLInputElement>(`[data-audio-scrubber="${msgId}"]`);
                    if (rangeEl) rangeEl.value = dur.toString();
                    this.playingAudioId.set(null);
                });
            });
            this.audioEls.set(msgId, el);
        }
        return this.audioEls.get(msgId)!;
    }

    private _startScrubberLoop(msgId: string): void {
        this._stopScrubberLoop();
        let frame = 0;
        const loop = () => {
            const el = this.audioEls.get(msgId);
            if (el && this.playingAudioId() === msgId) {
                const ct = el.currentTime;
                const rangeEl = document.querySelector<HTMLInputElement>(`[data-audio-scrubber="${msgId}"]`);
                if (rangeEl) rangeEl.value = ct.toString();
                // Update signal every 3 frames (~20 fps) so waveform bars stay in sync
                if (++frame % 3 === 0) {
                    this.zone.run(() => this.audioProgress.update(p => ({ ...p, [msgId]: ct })));
                }
                this._rafId = requestAnimationFrame(loop);
            } else {
                this._rafId = null;
            }
        };
        this._rafId = requestAnimationFrame(loop);
    }

    private _stopScrubberLoop(): void {
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    toggleAudio(msgId: string, src: string) {
        if (!isPlatformBrowser(this.platformId)) return;
        const el = this.getOrCreateAudioEl(msgId, src);
        const playing = this.playingAudioId();
        if (playing === msgId) {
            el.pause();
            this._stopScrubberLoop();
            this.playingAudioId.set(null);
        } else {
            if (playing) this.audioEls.get(playing)?.pause();
            el.play().catch(err => {
                this.errLog.reportClientError(
                    err?.message ?? 'Audio playback failed',
                    err?.stack,
                    'admin-chat:audio-play',
                ).subscribe();
            });
            this.playingAudioId.set(msgId);
            this._startScrubberLoop(msgId);
        }
    }

    seekAudio(msgId: string, src: string, value: string) {
        const el = this.getOrCreateAudioEl(msgId, src);
        el.currentTime = parseFloat(value);
        this.audioProgress.update(p => ({ ...p, [msgId]: parseFloat(value) }));
    }

    preloadAudio(msgId: string, src: string) {
        if (isPlatformBrowser(this.platformId)) this.getOrCreateAudioEl(msgId, src);
    }

    formatAudioTime(secs: number | undefined): string {
        if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    audioBarsFor(msgId: string): number[] {
        if (this._audioBarsCache.has(msgId)) return this._audioBarsCache.get(msgId)!;
        let hash = 5381;
        for (let i = 0; i < msgId.length; i++) {
            hash = ((hash << 5) + hash) ^ msgId.charCodeAt(i);
        }
        const bars = Array.from({ length: 28 }, (_, i) => {
            const v = Math.abs(((hash * (i + 1) * 1664525) + 1013904223) | 0);
            return 15 + (v % 70);
        });
        this._audioBarsCache.set(msgId, bars);
        return bars;
    }
}
