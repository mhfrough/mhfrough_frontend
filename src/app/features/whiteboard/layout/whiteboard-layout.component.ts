import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

@Component({
    selector: 'app-whiteboard-layout',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, RouterOutlet],
    templateUrl: './whiteboard-layout.component.html',
    styleUrl: './whiteboard-layout.component.scss',
})
export class WhiteboardLayoutComponent implements OnInit {
    private readonly seo = inject(SeoService);

    readonly year = new Date().getFullYear();
    /** Site-section switcher (Whiteboard / SEO Audits / Tools) — same open/close pattern as
     *  the equivalent dropdown in tools-layout.component.ts. */
    readonly menuOpen = signal(false);

    toggleMenu(event: Event): void {
        event.stopPropagation();
        this.menuOpen.update(v => !v);
    }

    @HostListener('document:click')
    onDocumentClick(): void {
        this.menuOpen.set(false);
    }

    ngOnInit(): void {
        this.seo.update({
            title: 'Whiteboard | Mohammad Hamza',
            description: 'An infinite collaborative whiteboard for sketching, diagramming and planning — built by Mohammad Hamza.',
            url: '/whiteboard',
        });
    }
}
