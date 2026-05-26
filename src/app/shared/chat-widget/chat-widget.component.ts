import {
    Component, OnInit, OnDestroy, inject, signal, PLATFORM_ID,
    ViewChild, ElementRef, effect, untracked, afterRenderEffect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChatService } from '../../core/services/chat.service';

@Component({
    selector: 'app-chat-widget',
    standalone: true,
    imports: [FormsModule, CommonModule],
    templateUrl: './chat-widget.component.html',
    styleUrl: './chat-widget.component.scss',
})
export class ChatWidgetComponent implements OnInit, OnDestroy {
    private readonly chatService = inject(ChatService);
    private readonly platformId = inject(PLATFORM_ID);

    @ViewChild('messagesEl') messagesEl!: ElementRef<HTMLDivElement>;

    readonly open = signal(false);
    readonly visible = signal(false);
    readonly started = signal(false);
    readonly unreadCount = signal(0);
    readonly messages = this.chatService.visitorMessages;
    readonly adminTyping = this.chatService.adminIsTyping;
    readonly sessionClosed = this.chatService.sessionClosed;
    readonly settings = this.chatService.settings;

    visitorName = '';
    message = '';
    greetingMessage = '';
    holdMessage = '';

    private typingTimeout?: ReturnType<typeof setTimeout>;
    private _visibleTimer?: ReturnType<typeof setTimeout>;
    private _shouldScroll = signal(false);
    private _prevMsgCount = -1;

    constructor() {
        // Scroll to bottom whenever new messages arrive or admin starts typing
        effect(() => {
            this.messages();      // track dependency
            this.adminTyping();   // track dependency
            untracked(() => {
                if (this.open()) this._shouldScroll.set(true);
            });
        });

        // Track unread admin messages while widget is closed
        effect(() => {
            const msgs = this.messages();
            untracked(() => {
                if (this._prevMsgCount >= 0 && !this.open()) {
                    const newAdminMsgs = msgs
                        .slice(this._prevMsgCount)
                        .filter(m => m.sender === 'admin').length;
                    if (newAdminMsgs > 0) this.unreadCount.update(n => n + newAdminMsgs);
                }
                this._prevMsgCount = msgs.length;
            });
        });

        // Perform the actual scroll after Angular has committed DOM updates
        afterRenderEffect(() => {
            if (this._shouldScroll()) {
                untracked(() => {
                    this._shouldScroll.set(false);
                    const el = this.messagesEl?.nativeElement;
                    if (el) el.scrollTop = el.scrollHeight;
                });
            }
        });
    }

    ngOnInit() {
        if (isPlatformBrowser(this.platformId)) {
            this.chatService.loadSettings();
            const { sessionId, visitorName } = this.chatService.getStoredSession();
            if (sessionId && visitorName) {
                this.visitorName = visitorName;
                this.started.set(true);
                this.chatService.connectAsVisitor(visitorName);
                // Already in an active session — show widget immediately
                this.visible.set(true);
            } else {
                // Delay trigger appearance by 7 seconds
                this._visibleTimer = setTimeout(() => this.visible.set(true), 7000);
            }
        }
    }

    ngOnDestroy() {
        clearTimeout(this._visibleTimer);
        this.chatService.disconnectVisitor();
    }

    toggle() {
        this.open.update(v => !v);
        if (this.open()) {
            this.unreadCount.set(0);
            this._shouldScroll.set(true);
            this.pickGreeting();
        }
    }

    private pickGreeting() {
        const s = this.settings();
        if (!s) return;
        const msgs = s.greeting_messages ?? [];
        if (msgs.length) {
            this.greetingMessage = msgs[Math.floor(Math.random() * msgs.length)];
        }
        const holds = s.hold_messages ?? [];
        if (holds.length) {
            this.holdMessage = holds[Math.floor(Math.random() * holds.length)];
        }
    }

    startChat() {
        const name = this.visitorName.trim();
        if (!name) return;
        this.started.set(true);
        this._shouldScroll.set(true);
        this.chatService.connectAsVisitor(name);
    }

    send() {
        const content = this.message.trim();
        if (!content || this.sessionClosed()) return;
        this.chatService.sendVisitorMessage(content);
        this.message = '';
        this._shouldScroll.set(true);
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.send();
        }
    }

    onInput() {
        this.chatService.sendVisitorTyping(true);
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.chatService.sendVisitorTyping(false), 1500);
    }

    autoResize(event: Event) {
        const el = event.target as HTMLTextAreaElement;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 100) + 'px';
    }

    trackById(_: number, m: { id: string }) { return m.id; }
}
