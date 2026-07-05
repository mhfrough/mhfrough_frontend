import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

@Component({
    selector: 'app-whiteboard-layout',
    standalone: true,
    imports: [RouterLink, RouterOutlet],
    templateUrl: './whiteboard-layout.component.html',
    styleUrl: './whiteboard-layout.component.scss',
})
export class WhiteboardLayoutComponent implements OnInit {
    private readonly seo = inject(SeoService);

    readonly year = new Date().getFullYear();

    ngOnInit(): void {
        this.seo.update({
            title: 'Whiteboard | Mohammad Hamza',
            description: 'An infinite collaborative whiteboard for sketching, diagramming and planning — built by Mohammad Hamza.',
            url: '/whiteboard',
        });
    }
}
