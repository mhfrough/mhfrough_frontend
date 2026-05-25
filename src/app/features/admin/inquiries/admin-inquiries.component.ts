import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InquiriesService } from '../../../core/services/inquiry-feedback.service';

@Component({
  selector: 'app-admin-inquiries',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-inquiries.component.html',
})
export class AdminInquiriesComponent implements OnInit {
  private service = inject(InquiriesService);
  readonly inquiries = signal<any[]>([]);
  readonly loading = signal(true);

  ngOnInit() { this.load(); }

  load() {
    this.service.getAll().subscribe({ next: (d: any[]) => { this.inquiries.set(d); this.loading.set(false); } });
  }

  markRead(id: string) {
    this.service.markRead(id).subscribe(() => this.load());
  }
}
