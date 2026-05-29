import {
    Component, OnInit, OnDestroy, inject, signal, computed, PLATFORM_ID,
    ViewChild, ElementRef, effect, untracked, afterRenderEffect, NgZone,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatSession, ChatMessage } from '../../../core/services/chat.service';
import { ActivityLogService } from '../../../core/services/activity-log.service';
import { SoundService } from '../../../core/services/sound.service';

@Component({
    selector: 'app-admin-chat',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './admin-chat.component.html',
    styleUrl: './admin-chat.component.scss',
})
export class AdminChatComponent implements OnInit, OnDestroy {
    private readonly chatService = inject(ChatService);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly activityLog = inject(ActivityLogService);
    private readonly sound = inject(SoundService);
    private readonly zone = inject(NgZone);

    @ViewChild('msgsEl') msgsEl!: ElementRef<HTMLDivElement>;

    readonly sessions = this.chatService.sessions;
    readonly activeMsgs = this.chatService.activeMsgs;
    readonly activeSessionId = this.chatService.activeSessionId;
    readonly visitorTyping = this.chatService.visitorTyping;
    readonly settings = this.chatService.settings;

    activeTab: 'chat' | 'settings' = 'chat';
    messageText = '';

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
        });
    }

    ngOnInit() {
        this.chatService.loadSettings();
    }

    ngOnDestroy() {
        // socket managed by AdminLayoutComponent
        this._stopTitleBlink();
        this._stopScrubberLoop();
        this._cleanupRecording();
        this.audioEls.forEach(el => { el.pause(); el.src = ''; });
        this.audioEls.clear();
    }

    selectSession(session: ChatSession) {
        this.chatService.selectSession(session.id);
        // Title will reset automatically once unreadChatCount drops to 0 via sessions:update
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
            this.activityLog.reportClientError(
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
                    this.activityLog.reportClientError(
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
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
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
                this.activityLog.reportClientError(
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
