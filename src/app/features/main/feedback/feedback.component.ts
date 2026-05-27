import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FeedbackService } from '../../../core/services/inquiry-feedback.service';
import { UserInfoService } from '../../../core/services/user-info.service';
import { RealtimeService } from '../../../core/services/realtime.service';

@Component({
    selector: 'app-feedback',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './feedback.component.html',
})
export class FeedbackComponent implements OnInit, OnDestroy {
    private service = inject(FeedbackService);
    private userInfo = inject(UserInfoService);
    private readonly realtime = inject(RealtimeService);
    readonly sending = signal(false);
    readonly sent = signal(false);
    readonly error = signal('');
    readonly reviews = signal<any[]>([]);
    readonly loadingReviews = signal(true);
    selectedRating = 5;
    readonly stars = [1, 2, 3, 4, 5];
    private subs = new Subscription();

    formData = { name: '', email: '', role: '', company: '', review: '' };

    ngOnInit() {
        const saved = this.userInfo.get();
        if (saved) {
            this.formData = { ...this.formData, name: saved.name ?? '', email: saved.email ?? '' };
        }
        this.service.getApproved().subscribe({
            next: (data: any[]) => { this.reviews.set(data); this.loadingReviews.set(false); },
            error: () => this.loadingReviews.set(false),
        });

        // Admin approved a review → append to public list
        this.subs.add(this.realtime.on<any>('feedback:approved').subscribe(item => {
            this.reviews.update(list => {
                const exists = list.some(r => r.id === item.id);
                return exists ? list.map(r => r.id === item.id ? item : r) : [...list, item];
            });
        }));

        // Admin unapproved/deleted → remove from public list
        this.subs.add(this.realtime.on<{ id: string }>('feedback:unapproved').subscribe(({ id }) => {
            this.reviews.update(list => list.filter(r => r.id !== id));
        }));
        this.subs.add(this.realtime.on<{ id: string }>('feedback:deleted').subscribe(({ id }) => {
            this.reviews.update(list => list.filter(r => r.id !== id));
        }));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    submit(form: NgForm) {
        form.form.markAllAsTouched();
        if (form.invalid) return;
        this.sending.set(true);
        this.error.set('');
        this.service.submit({ ...form.value, rating: this.selectedRating }).subscribe({
            next: () => {
                this.userInfo.save({ name: form.value.name, email: form.value.email });
                this.sent.set(true);
                this.sending.set(false);
                form.reset();
                this.selectedRating = 5;
            },
            error: () => { this.error.set('Something went wrong. Please try again.'); this.sending.set(false); },
        });
    }
}
