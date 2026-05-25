import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  readonly stats = signal<any>(null);

  ngOnInit() {
    this.http.get(`${environment.apiUrl}/admin/dashboard`).subscribe({
      next: (data) => this.stats.set(data),
    });
  }
}
