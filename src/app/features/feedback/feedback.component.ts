import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { FeedbackService } from '../../core/services/inquiry-feedback.service';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback.component.html',
})
export class FeedbackComponent {
  private service = inject(FeedbackService);
  readonly sending = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');
  selectedRating = 5;

  submit(form: NgForm) {
    if (form.invalid) return;
    this.sending.set(true);
    this.error.set('');
    this.service.submit({ ...form.value, rating: this.selectedRating }).subscribe({
      next: () => { this.sent.set(true); this.sending.set(false); form.reset(); this.selectedRating = 5; },
      error: () => { this.error.set('Something went wrong. Please try again.'); this.sending.set(false); },
    });
  }

  stars = [1, 2, 3, 4, 5];
}
