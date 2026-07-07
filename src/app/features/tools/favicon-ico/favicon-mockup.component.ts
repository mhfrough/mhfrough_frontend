import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type MockupKind =
    | 'browser-tab'
    | 'bookmark'
    | 'windows-shortcut'
    | 'macos-dock'
    | 'android-home'
    | 'iphone-home';

/** Stylized (not photorealistic) CSS device-frame preview of a favicon in context. */
@Component({
    selector: 'app-favicon-mockup',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './favicon-mockup.component.html',
    styleUrl: './favicon-mockup.component.scss',
})
export class FaviconMockupComponent {
    @Input() iconUrl: string | null = null;
    @Input() kind: MockupKind = 'browser-tab';
    @Input() siteName = 'Site';
}
