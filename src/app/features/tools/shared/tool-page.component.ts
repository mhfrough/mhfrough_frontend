import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * Shared chrome for an individual tool page: breadcrumb back to /tools,
 * title + icon + blurb header, and an optional loading/error strip wrapping
 * the projected tool UI.
 */
@Component({
    selector: 'app-tool-page',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './tool-page.component.html',
    styleUrl: './tool-page.component.scss',
})
export class ToolPageComponent {
    @Input({ required: true }) title = '';
    @Input() blurb = '';
    @Input() icon = '';
    @Input() loading = false;
    @Input() error: string | null = null;
}
