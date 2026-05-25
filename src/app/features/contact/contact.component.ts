import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { InquiriesService } from '../../core/services/inquiry-feedback.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.component.html',
})
export class ContactComponent {
  private service = inject(InquiriesService);
  readonly sending = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');

  submit(form: NgForm) {
    if (form.invalid) return;
    this.sending.set(true);
    this.error.set('');
    this.service.submit(form.value).subscribe({
      next: () => { this.sent.set(true); this.sending.set(false); form.reset(); },
      error: () => { this.error.set('Something went wrong. Please try again.'); this.sending.set(false); },
    });
  }
}
