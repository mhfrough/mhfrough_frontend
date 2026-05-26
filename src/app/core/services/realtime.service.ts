import { Injectable, PLATFORM_ID, inject, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Socket } from 'socket.io-client';

@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
    private readonly platformId = inject(PLATFORM_ID);
    private socket?: Socket;
    private connected = false;
    private isAdmin = false;
    private readonly subjects = new Map<string, Subject<unknown>>();

    private subject<T>(event: string): Subject<T> {
        if (!this.subjects.has(event)) {
            this.subjects.set(event, new Subject<unknown>());
        }
        return this.subjects.get(event) as Subject<T>;
    }

    /** Subscribe to a real-time event from the server */
    on<T>(event: string): Observable<T> {
        return this.subject<T>(event).asObservable();
    }

    /** Connect to the /events namespace. Safe to call multiple times. */
    async connect(): Promise<void> {
        if (!isPlatformBrowser(this.platformId) || this.connected) return;
        this.connected = true;
        const { io } = await import('socket.io-client');
        const socketUrl = environment.apiUrl.replace('/api/v1', '');

        this.socket = io(`${socketUrl}/events`, {
            transports: ['websocket', 'polling'],
        });

        this.socket.on('connect', () => {
            if (this.isAdmin) {
                this.socket!.emit('join_admin');
            }
        });

        this.socket.onAny((event: string, data: unknown) => {
            this.subject(event).next(data);
        });
    }

    /** Call after connect() for admin portal pages */
    joinAdmin(): void {
        this.isAdmin = true;
        if (this.socket?.connected) {
            this.socket.emit('join_admin');
        }
        // If not yet connected, the 'connect' handler above will join on connect
    }

    disconnect(): void {
        this.socket?.disconnect();
        this.connected = false;
        this.isAdmin = false;
    }

    ngOnDestroy(): void {
        this.disconnect();
        this.subjects.forEach(s => s.complete());
        this.subjects.clear();
    }
}
