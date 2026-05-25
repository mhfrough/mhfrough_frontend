import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectsService } from '../../core/services/projects.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private projectsService = inject(ProjectsService);
  readonly projects = signal<any[]>([]);
  readonly loadingProjects = signal(true);

  readonly skills = [
    { name: 'Angular', level: 95 }, { name: 'React', level: 85 },
    { name: 'TypeScript', level: 92 }, { name: 'Node.js / NestJS', level: 80 },
    { name: 'SCSS / Bootstrap', level: 90 }, { name: 'PostgreSQL', level: 75 },
    { name: 'UI/UX / Adobe XD', level: 82 }, { name: 'SEO & Web Performance', level: 88 },
  ];

  readonly experience = [
    {
      role: 'Senior Frontend Developer',
      company: 'Arittek Solutions (Pvt.) Ltd.',
      period: '2021 – Present',
      desc: 'Leading frontend development for fintech and SaaS products. Architected micro-frontend solutions for Befiler, Emlaak Financials, Asaan Hisab, and KPMC portals.',
    },
    {
      role: 'Frontend Developer',
      company: 'Freelance / Self-employed',
      period: '2020 – 2021',
      desc: 'Delivered responsive web applications and UI/UX designs for clients across Pakistan. Angular, React, PHP projects.',
    },
  ];

  readonly started = new Date('2020-01-06');
  get yearsExp(): number {
    return Math.floor((Date.now() - this.started.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  }

  ngOnInit() {
    this.projectsService.getAll().subscribe({
      next: (data: any[]) => { this.projects.set(data); this.loadingProjects.set(false); },
      error: () => this.loadingProjects.set(false),
    });
  }
}
