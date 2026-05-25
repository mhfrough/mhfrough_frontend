import { Component, OnInit, HostListener, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly theme = inject(ThemeService);
  readonly showBackToTop = signal(false);
  readonly chatOpen = signal(false);
  readonly navCollapsed = signal(true);
  readonly year = new Date().getFullYear();

  readonly tickerItems = [
    'Senior Frontend Developer', 'Angular · React · Node.js',
    'Karachi, Pakistan', '6+ Years Experience',
    'Fintech · SaaS · Government', 'Micro Frontend Architecture',
    'Open to Opportunities', 'mhfrough.dev',
  ];

  ngOnInit() { this.theme.init(); }

  @HostListener('window:scroll')
  onScroll() { this.showBackToTop.set(window.scrollY > 400); }

  scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  toggleChat() { this.chatOpen.update(v => !v); }
  toggleNav() { this.navCollapsed.update(v => !v); }
}
