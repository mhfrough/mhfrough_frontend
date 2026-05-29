import {
    Component, OnInit, OnDestroy, inject, signal, PLATFORM_ID,
    ViewChild, ElementRef, effect, untracked, afterRenderEffect, NgZone,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChatService } from '../../core/services/chat.service';
import { FooterSettingsService } from '../../core/services/footer-settings.service';
import { ActivityLogService } from '../../core/services/activity-log.service';
import { SoundService } from '../../core/services/sound.service';
import { ImgFallbackDirective } from '../directives/img-fallback.directive';

@Component({
    selector: 'app-chat-widget',
    standalone: true,
    imports: [FormsModule, CommonModule, ImgFallbackDirective],
    templateUrl: './chat-widget.component.html',
    styleUrl: './chat-widget.component.scss',
})
export class ChatWidgetComponent implements OnInit, OnDestroy {
    private readonly chatService = inject(ChatService);
    private readonly platformId = inject(PLATFORM_ID);
    readonly footerSettings = inject(FooterSettingsService);
    private readonly activityLog = inject(ActivityLogService);
    private readonly sound = inject(SoundService);
    private readonly zone = inject(NgZone);

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

    private typingTimeout?: ReturnType<typeof setTimeout>;
    private _visibleTimer?: ReturnType<typeof setTimeout>;
    private _shouldScroll = signal(false);
    private _prevMsgCount = -1;
    private _titleBlinkInterval?: ReturnType<typeof setInterval>;
    private _originalTitle = '';

    constructor() {
        // Scroll to bottom whenever new messages arrive or admin starts typing
        effect(() => {
            this.messages();      // track dependency
            this.adminTyping();   // track dependency
            untracked(() => {
                if (this.open()) this._shouldScroll.set(true);
            });
        });

        // Track unread admin messages while widget is closed — play sound + blink title
        effect(() => {
            const msgs = this.messages();
            untracked(() => {
                if (this._prevMsgCount >= 0 && !this.open()) {
                    const newAdminMsgs = msgs
                        .slice(this._prevMsgCount)
                        .filter(m => m.sender === 'admin').length;
                    if (newAdminMsgs > 0) {
                        this.unreadCount.update(n => n + newAdminMsgs);
                        if (isPlatformBrowser(this.platformId)) {
                            this.sound.play('notification');
                            this._startTitleBlink();
                        }
                    }
                }
                this._prevMsgCount = msgs.length;
            });
        });

        // Eagerly preload audio metadata for any audio messages
        effect(() => {
            const msgs = this.messages();
            untracked(() => {
                if (!isPlatformBrowser(this.platformId)) return;
                msgs.filter(m => m.messageType === 'audio' && m.audioUrl)
                    .forEach(m => this.getOrCreateAudioEl(m.id, m.audioUrl!));
            });
        });

        // Stop title blink once unread count reaches 0
        effect(() => {
            const count = this.unreadCount();
            if (count === 0) untracked(() => this._stopTitleBlink());
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
            this.footerSettings.load();
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
        this._stopTitleBlink();
        this.chatService.disconnectVisitor();
        this._cleanupRecording();
        this.audioEls.forEach(el => { el.pause(); el.src = ''; });
        this.audioEls.clear();
    }

    toggle() {
        this.open.update(v => !v);
        if (this.open()) {
            this.unreadCount.set(0);
            this._prevMsgCount = this.messages().length;
            this._stopTitleBlink();
            this._shouldScroll.set(true);
            this.pickGreeting();
        }
    }

    private _startTitleBlink(): void {
        if (!isPlatformBrowser(this.platformId) || this._titleBlinkInterval) return;
        this._originalTitle = document.title;
        let blink = false;
        this._titleBlinkInterval = setInterval(() => {
            document.title = blink ? '💬 New Message' : this._originalTitle;
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

    startNewChat() {
        this.chatService.resetVisitorSession();
        this.visitorName = '';
        this.started.set(false);
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
                'chat-widget:startRecording',
            ).subscribe();
        }
    }

    stopAndSend() {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;
        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
            this._cleanupRecording();
            this.isRecording.set(false);
            this.recordingSeconds.set(0);
            this.waveformBars.set(Array(28).fill(0));
            this.isUploadingAudio.set(true);

            this.chatService.uploadChatAudio(blob).subscribe({
                next: ({ url }) => {
                    this.chatService.sendVisitorAudioMessage(url);
                    this.isUploadingAudio.set(false);
                },
                error: (err) => {
                    this.isUploadingAudio.set(false);
                    this.activityLog.reportClientError(
                        err?.message ?? 'Audio upload failed',
                        err?.stack,
                        'chat-widget:stopAndSend',
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
                this.zone.run(() => this.playingAudioId.set(null));
            });
            this.audioEls.set(msgId, el);
        }
        return this.audioEls.get(msgId)!;
    }

    toggleAudio(msgId: string, src: string) {
        if (!isPlatformBrowser(this.platformId)) return;
        const el = this.getOrCreateAudioEl(msgId, src);
        const playing = this.playingAudioId();
        if (playing === msgId) {
            el.pause();
            this.playingAudioId.set(null);
        } else {
            if (playing) this.audioEls.get(playing)?.pause();
            el.play().catch(err => {
                this.activityLog.reportClientError(
                    err?.message ?? 'Audio playback failed',
                    err?.stack,
                    'chat-widget:audio-play',
                ).subscribe();
            });
            this.playingAudioId.set(msgId);
        }
    }

    seekAudio(msgId: string, src: string, value: string) {
        const el = this.getOrCreateAudioEl(msgId, src);
        el.currentTime = parseFloat(value);
        this.audioProgress.update(p => ({ ...p, [msgId]: parseFloat(value) }));
    }

    /** Called on mousedown on the scrubber to eagerly load audio metadata */
    getOrCreateAudioEl_noop(msgId: string, src: string) {
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
