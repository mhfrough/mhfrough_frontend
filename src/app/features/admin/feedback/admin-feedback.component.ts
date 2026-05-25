import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeedbackService } from '../../../core/services/inquiry-feedback.service';

@Component({
  selector: 'app-admin-feedback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-feedback.component.html',
})
export class AdminFeedbackComponent implements OnInit {
  private service = inject(FeedbackService);
  readonly feedback = signal<any[]>([]);
  readonly loading = signal(true);

  ngOnInit() { this.load(); }

  load() {
    this.service.getAll().subscribe({ next: (d: any[]) => { this.feedback.set(d); this.loading.set(false); } });
  }

  approve(id: string) { this.service.approve(id).subscribe(() => this.load()); }
  remove(id: string) {
    if (!confirm('Delete this review?')) return;
    this.service.remove(id).subscribe(() => this.load());
  }
}
