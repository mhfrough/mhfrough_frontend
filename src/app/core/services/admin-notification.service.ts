import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

export interface AdminToast {
    id: number;
    type: 'inquiry' | 'feedback' | 'comment';
    message: string;
}

@Injectable({ providedIn: 'root' })
export class AdminNotificationService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);

    readonly unreadInquiries = signal(0);
    readonly pendingFeedback = signal(0);
    readonly pendingComments = signal(0);
    readonly toasts = signal<AdminToast[]>([]);

    private readonly _inquiriesChanged$ = new Subject<void>();
    private readonly _feedbackChanged$ = new Subject<void>();
    private readonly _commentsChanged$ = new Subject<void>();
    readonly inquiriesChanged$ = this._inquiriesChanged$.asObservable();
    readonly feedbackChanged$ = this._feedbackChanged$.asObservable();
    readonly commentsChanged$ = this._commentsChanged$.asObservable();

    private eventSource?: EventSource;
    private toastId = 0;
    private connected = false;

    init(): void {
        if (!isPlatformBrowser(this.platformId) || this.connected) return;
        this.connected = true;
        this.fetchCounts();
        this.connect();
    }

    fetchCounts(): void {
        this.http.get<{ inquiries: { new: number }; feedback: { pending: number }; comments: { pending: number } }>(
            `${environment.apiUrl}/admin/counts`,
        ).subscribe({
            next: (data) => {
                this.unreadInquiries.set(data.inquiries.new);
                this.pendingFeedback.set(data.feedback.pending);
                this.pendingComments.set(data.comments?.pending ?? 0);
            },
        });
    }

    private connect(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.eventSource?.close();
        this.eventSource = new EventSource(`${environment.apiUrl}/admin/stream`, { withCredentials: true });

        this.eventSource.onmessage = (e: MessageEvent) => {
            try {
                const event = JSON.parse(e.data) as { type: 'new_inquiry' | 'new_feedback' | 'new_comment' };
                this.fetchCounts();
                if (event.type === 'new_inquiry') {
                    this._inquiriesChanged$.next();
                    this.pushToast('inquiry', 'New inquiry received');
                } else if (event.type === 'new_feedback') {
                    this._feedbackChanged$.next();
                    this.pushToast('feedback', 'New feedback received');
                } else if (event.type === 'new_comment') {
                    this._commentsChanged$.next();
                    this.pushToast('comment', 'New blog comment received');
                }
            } catch { /* ignore malformed */ }
        };

        this.eventSource.onerror = () => {
            this.eventSource?.close();
            setTimeout(() => this.connect(), 5000);
        };
    }

    private pushToast(type: 'inquiry' | 'feedback' | 'comment', message: string): void {
        const id = ++this.toastId;
        this.toasts.update(list => [...list, { id, type, message }]);
        setTimeout(() => this.dismissToast(id), 5000);
    }

    dismissToast(id: number): void {
        this.toasts.update(list => list.filter(t => t.id !== id));
    }

    disconnect(): void {
        this.eventSource?.close();
        this.connected = false;
    }
}
