import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ProjectsService } from '../../../core/services/projects.service';

@Component({
  selector: 'app-admin-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-projects.component.html',
})
export class AdminProjectsComponent implements OnInit {
  private service = inject(ProjectsService);
  readonly projects = signal<any[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly editing = signal<any>(null);
  readonly showForm = signal(false);

  ngOnInit() { this.load(); }

  load() {
    this.service.getAllAdmin().subscribe({ next: (d: any[]) => { this.projects.set(d); this.loading.set(false); } });
  }

  openNew() { this.editing.set(null); this.showForm.set(true); }

  edit(p: any) { this.editing.set({ ...p, techStack: p.techStack?.join(', ') }); this.showForm.set(true); }

  cancel() { this.showForm.set(false); this.editing.set(null); }

  save(form: NgForm) {
    if (form.invalid) return;
    this.saving.set(true);
    const payload = { ...form.value, techStack: form.value.techStack?.split(',').map((s: string) => s.trim()).filter(Boolean) };
    const obs = this.editing() ? this.service.update(this.editing().id, payload) : this.service.create(payload);
    obs.subscribe({ next: () => { this.load(); this.cancel(); this.saving.set(false); } });
  }

  remove(id: string) {
    if (!confirm('Delete this project?')) return;
    this.service.remove(id).subscribe(() => this.load());
  }
}
