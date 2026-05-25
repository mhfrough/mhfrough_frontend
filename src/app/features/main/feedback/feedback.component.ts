import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { FeedbackService } from '../../../core/services/inquiry-feedback.service';
import { UserInfoService } from '../../../core/services/user-info.service';

@Component({
    selector: 'app-feedback',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './feedback.component.html',
})
export class FeedbackComponent implements OnInit {
    private service = inject(FeedbackService);
    private userInfo = inject(UserInfoService);
    readonly sending = signal(false);
    readonly sent = signal(false);
    readonly error = signal('');
    readonly reviews = signal<any[]>([]);
    readonly loadingReviews = signal(true);
    selectedRating = 5;
    readonly stars = [1, 2, 3, 4, 5];

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
    }

    submit(form: NgForm) {
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
