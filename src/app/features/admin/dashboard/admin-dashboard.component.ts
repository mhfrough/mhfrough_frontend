import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    private readonly http = inject(HttpClient);
    private readonly notif = inject(AdminNotificationService);
    readonly stats = signal<any>(null);
    private subs = new Subscription();

    ngOnInit() {
        this.load();
        this.subs.add(this.notif.inquiriesChanged$.subscribe(() => this.load()));
        this.subs.add(this.notif.feedbackChanged$.subscribe(() => this.load()));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    private load() {
        this.http.get(`${environment.apiUrl}/admin/dashboard`).subscribe({
            next: (data) => this.stats.set(data),
        });
    }
}
