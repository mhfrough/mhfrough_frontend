import {
    Component, OnInit, OnDestroy, inject, signal, computed,
    ViewChild, ElementRef, effect, untracked, afterRenderEffect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatSession, ChatMessage } from '../../../core/services/chat.service';

@Component({
    selector: 'app-admin-chat',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './admin-chat.component.html',
    styleUrl: './admin-chat.component.scss',
})
export class AdminChatComponent implements OnInit, OnDestroy {
    private readonly chatService = inject(ChatService);

    @ViewChild('msgsEl') msgsEl!: ElementRef<HTMLDivElement>;

    readonly sessions = this.chatService.sessions;
    readonly activeMsgs = this.chatService.activeMsgs;
    readonly activeSessionId = this.chatService.activeSessionId;
    readonly visitorTyping = this.chatService.visitorTyping;
    readonly settings = this.chatService.settings;

    activeTab: 'chat' | 'settings' = 'chat';
    messageText = '';

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
    settingsSaved = false;

    private typingTimeout?: ReturnType<typeof setTimeout>;
    private _shouldScroll = signal(false);

    constructor() {
        // Scroll when active messages change
        effect(() => {
            this.activeMsgs(); // track dependency
            untracked(() => { this._shouldScroll.set(true); });
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

        // Perform the actual scroll after Angular has committed DOM updates
        afterRenderEffect(() => {
            if (this._shouldScroll()) {
                untracked(() => {
                    this._shouldScroll.set(false);
                    const el = this.msgsEl?.nativeElement;
                    if (el) el.scrollTop = el.scrollHeight;
                });
            }
        });
    }

    ngOnInit() {
        this.chatService.loadSettings();
    }

    ngOnDestroy() {
        // socket managed by AdminLayoutComponent
    }

    selectSession(session: ChatSession) {
        this.chatService.selectSession(session.id);
    }

    sendMessage() {
        const content = this.messageText.trim();
        const sessionId = this.activeSessionId();
        if (!content || !sessionId) return;
        this.chatService.sendAdminMessage(sessionId, content);
        this.messageText = '';
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    onInput() {
        const sessionId = this.activeSessionId();
        if (!sessionId) return;
        this.chatService.sendAdminTyping(sessionId, true);
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.chatService.sendAdminTyping(sessionId, false), 1500);
    }

    autoResize(event: Event) {
        const el = event.target as HTMLTextAreaElement;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
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
            }
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
        const saves = [
            this.chatService.saveSettings('greeting_messages', this.greetingMessages.filter(m => m.trim())),
            this.chatService.saveSettings('hold_messages', this.holdMessages.filter(m => m.trim())),
            this.chatService.saveSettings('status_message', this.statusMessage),
        ];
        let done = 0;
        for (const obs of saves) {
            obs.subscribe(() => {
                done++;
                if (done === saves.length) {
                    this.chatService.loadSettings();
                    this.settingsSaved = true;
                    setTimeout(() => this.settingsSaved = false, 3000);
                }
            });
        }
    }

    trackById(_: number, m: { id: string }) { return m.id; }
    trackBySessionId(_: number, s: ChatSession) { return s.id; }
}
