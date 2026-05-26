import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { Socket } from 'socket.io-client';

export interface ChatMessage {
    id: string;
    sessionId: string;
    content: string;
    sender: 'visitor' | 'admin';
    read: boolean;
    createdAt: string;
}

export interface ChatSession {
    id: string;
    visitorName: string;
    status: 'active' | 'closed';
    createdAt: string;
    lastActivityAt: string;
    unreadCount: number;
}

export interface ChatSettings {
    greeting_messages: string[];
    hold_messages: string[];
    status_message: string;
}

const SESSION_KEY = 'chat_session_id';
const VISITOR_NAME_KEY = 'chat_visitor_name';

@Injectable({ providedIn: 'root' })
export class ChatService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);

    private socket?: Socket;
    private socketUrl = environment.apiUrl.replace('/api/v1', '');

    // ─── Visitor state (chat widget) ─────────────────────────────────────────
    readonly visitorSessionId = signal<string | null>(null);
    readonly visitorMessages = signal<ChatMessage[]>([]);
    readonly adminIsTyping = signal(false);
    readonly sessionClosed = signal(false);

    // ─── Admin state ─────────────────────────────────────────────────────────
    readonly sessions = signal<ChatSession[]>([]);
    readonly activeMsgs = signal<ChatMessage[]>([]);
    readonly activeSessionId = signal<string | null>(null);
    readonly visitorTyping = signal<{ sessionId: string; isTyping: boolean } | null>(null);
    readonly unreadChatCount = signal(0);

    // ─── Settings ─────────────────────────────────────────────────────────────
    readonly settings = signal<ChatSettings | null>(null);

    loadSettings() {
        this.http.get<ChatSettings>(`${environment.apiUrl}/chat/settings`).subscribe({
            next: (s) => this.settings.set(s),
        });
    }

    saveSettings(key: string, value: unknown) {
        return this.http.post(`${environment.apiUrl}/chat/settings`, { key, value });
    }

    // ─── Visitor WebSocket ────────────────────────────────────────────────────

    async connectAsVisitor(visitorName: string) {
        if (!isPlatformBrowser(this.platformId)) return;

        const sessionId = sessionStorage.getItem(SESSION_KEY);
        const { io } = await import('socket.io-client');

        this.socket = io(`${this.socketUrl}/chat`, {
            transports: ['websocket', 'polling'],
        });

        this.socket.on('connect', () => {
            this.socket!.emit(
                'visitor:join',
                { visitorName, sessionId: sessionId ?? undefined },
                (res: { sessionId: string; messages: ChatMessage[] }) => {
                    sessionStorage.setItem(SESSION_KEY, res.sessionId);
                    sessionStorage.setItem(VISITOR_NAME_KEY, visitorName);
                    this.visitorSessionId.set(res.sessionId);
                    this.visitorMessages.set(res.messages);
                },
            );
        });

        this.socket.on('message:new', (msg: ChatMessage) => {
            this.visitorMessages.update(m => [...m, msg]);
        });

        this.socket.on('admin:typing', (data: { isTyping: boolean }) => {
            this.adminIsTyping.set(data.isTyping);
        });

        this.socket.on('session:closed', () => {
            this.sessionClosed.set(true);
        });
    }

    sendVisitorMessage(content: string) {
        const sessionId = this.visitorSessionId();
        if (!sessionId) return;
        this.socket?.emit('visitor:message', { sessionId, content });
    }

    sendVisitorTyping(isTyping: boolean) {
        const sessionId = this.visitorSessionId();
        if (!sessionId) return;
        this.socket?.emit('visitor:typing', { sessionId, isTyping });
    }

    getStoredSession(): { sessionId: string | null; visitorName: string | null } {
        if (!isPlatformBrowser(this.platformId)) return { sessionId: null, visitorName: null };
        return {
            sessionId: sessionStorage.getItem(SESSION_KEY),
            visitorName: sessionStorage.getItem(VISITOR_NAME_KEY),
        };
    }

    disconnectVisitor() {
        this.socket?.disconnect();
    }

    // ─── Admin WebSocket ──────────────────────────────────────────────────────

    private adminConnected = false;

    async connectAsAdmin() {
        if (!isPlatformBrowser(this.platformId) || this.adminConnected) return;
        this.adminConnected = true;
        const { io } = await import('socket.io-client');

        this.socket = io(`${this.socketUrl}/chat`, {
            transports: ['websocket', 'polling'],
        });

        this.socket.on('connect', () => {
            this.socket!.emit('admin:join', null, (sessions: ChatSession[]) => {
                this.sessions.set(sessions);
                this.updateUnreadCount(sessions);
            });
        });

        this.socket.on('sessions:update', (sessions: ChatSession[]) => {
            this.sessions.set(sessions);
            this.updateUnreadCount(sessions);
        });

        this.socket.on('message:new', (msg: ChatMessage) => {
            if (msg.sessionId === this.activeSessionId()) {
                this.activeMsgs.update(m => [...m, msg]);
            }
        });

        this.socket.on('visitor:typing', (data: { sessionId: string; isTyping: boolean }) => {
            this.visitorTyping.set(data);
        });
    }

    selectSession(sessionId: string) {
        this.activeSessionId.set(sessionId);
        this.socket?.emit('admin:select_session', { sessionId }, (msgs: ChatMessage[]) => {
            this.activeMsgs.set(msgs);
        });
    }

    sendAdminMessage(sessionId: string, content: string) {
        this.socket?.emit('admin:message', { sessionId, content }, (msg: ChatMessage) => {
            if (msg) this.activeMsgs.update(m => [...m, msg]);
        });
    }

    sendAdminTyping(sessionId: string, isTyping: boolean) {
        this.socket?.emit('admin:typing', { sessionId, isTyping });
    }

    closeSession(sessionId: string) {
        this.socket?.emit('admin:close_session', { sessionId });
    }

    deleteSession(sessionId: string) {
        return this.http.delete(`${environment.apiUrl}/chat/sessions/${sessionId}`);
    }

    disconnectAdmin() {
        this.adminConnected = false;
        this.socket?.disconnect();
    }

    private updateUnreadCount(sessions: ChatSession[]) {
        const count = sessions.reduce((sum, s) => sum + (s.unreadCount ?? 0), 0);
        this.unreadChatCount.set(count);
    }
}
