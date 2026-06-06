import {
    Component, OnInit, OnDestroy, inject, signal, computed, PLATFORM_ID,
    ViewChild, ElementRef, effect, untracked, afterRenderEffect, NgZone,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ChatService, ChatSession, ChatMessage, VisitorActivity } from '../../../core/services/chat.service';
import { ActivityLogService } from '../../../core/services/activity-log.service';

@Component({
    selector: 'app-admin-floating-chat',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './admin-floating-chat.component.html',
    styleUrl: './admin-floating-chat.component.scss',
})
export class AdminFloatingChatComponent implements OnInit, OnDestroy {
    private readonly chatService = inject(ChatService);
    private readonly router = inject(Router);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly activityLog = inject(ActivityLogService);
    private readonly zone = inject(NgZone);

    @ViewChild('msgsEl') msgsEl!: ElementRef<HTMLDivElement>;

    readonly sessions = this.chatService.sessions;
    readonly activeMsgs = this.chatService.activeMsgs;
    readonly activeSessionId = this.chatService.activeSessionId;
    readonly visitorTyping = this.chatService.visitorTyping;
    readonly unreadChatCount = this.chatService.unreadChatCount;
    readonly currentPageMap = this.chatService.currentPageMap;

    readonly open = signal(false);
    readonly onChatPage = signal(false);
    readonly messageText = signal('');

    private typingTimeout?: ReturnType<typeof setTimeout>;
    private subs = new Subscription();
    private _shouldScroll = signal(false);

    readonly filteredSessions = computed(() =>
        this.sessions().filter(s => s.status === 'active' || s.unreadCount > 0)
    );

    constructor() {
        effect(() => {
            this.activeMsgs();
            untracked(() => { this._shouldScroll.set(true); });
        });

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
        this.onChatPage.set(this.router.url.includes('/admin/chat'));
        this.subs.add(
            this.router.events.pipe(filter(e => e instanceof NavigationEnd))
                .subscribe((e) => {
                    this.onChatPage.set((e as NavigationEnd).urlAfterRedirects.includes('/admin/chat'));
                    if (this.onChatPage()) this.open.set(false);
                })
        );
    }

    ngOnDestroy() {
        this.subs.unsubscribe();
    }

    toggle() {
        this.open.update(v => !v);
    }

    selectSession(session: ChatSession) {
        this.chatService.selectSession(session.id);
    }

    getSession(): ChatSession | undefined {
        return this.sessions().find(s => s.id === this.activeSessionId());
    }

    isVisitorTyping(): boolean {
        const t = this.visitorTyping();
        return !!(t && t.sessionId === this.activeSessionId() && t.isTyping);
    }

    getCurrentPage(): string | null {
        const session = this.getSession();
        const vsId = session?.visitorSessionId;
        if (!vsId) return null;
        return this.currentPageMap()[vsId] ?? null;
    }

    sendMessage() {
        const content = this.messageText().trim();
        const sessionId = this.activeSessionId();
        if (!content || !sessionId) return;
        this.chatService.sendAdminMessage(sessionId, content);
        this.messageText.set('');
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    onInput(event: Event) {
        const sessionId = this.activeSessionId();
        if (!sessionId) return;
        this.chatService.sendAdminTyping(sessionId, true);
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.chatService.sendAdminTyping(sessionId, false), 1500);
    }

    clearActive() {
        this.chatService.activeSessionId.set(null);
        this.chatService.activeMsgs.set([]);
    }

    trackById(_: number, m: { id: string }) { return m.id; }
    trackBySessionId(_: number, s: ChatSession) { return s.id; }

    formatTime(dateStr: string): string {
        const d = new Date(dateStr);
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
    }
}
