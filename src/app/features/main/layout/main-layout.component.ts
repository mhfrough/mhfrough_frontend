import { Component, HostListener, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { WhatsappWidgetComponent } from '../../../shared/whatsapp-widget/whatsapp-widget.component';

@Component({
    selector: 'app-main-layout',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, WhatsappWidgetComponent],
    templateUrl: './main-layout.component.html',
})
export class MainLayoutComponent implements OnInit, OnDestroy {
    readonly theme = inject(ThemeService);
    readonly showBackToTop = signal(false);
    readonly navOpen = signal(false);
    readonly year = new Date().getFullYear();
    readonly currentTime = signal('');

    private timeInterval?: ReturnType<typeof setInterval>;

    ngOnInit() {
        this.updateTime();
        this.timeInterval = setInterval(() => this.updateTime(), 1000);
    }

    ngOnDestroy() {
        if (this.timeInterval) clearInterval(this.timeInterval);
    }

    private updateTime() {
        const now = new Date();
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        this.currentTime.set(`${h}:${m}`);
    }

    @HostListener('window:scroll')
    onScroll() { this.showBackToTop.set(window.scrollY > 500); }

    scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    toggleNav() { this.navOpen.update(v => !v); }
}
