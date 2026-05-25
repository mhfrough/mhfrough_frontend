import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-whatsapp-widget',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './whatsapp-widget.component.html',
    styleUrl: './whatsapp-widget.component.scss',
})
export class WhatsappWidgetComponent {
    readonly open = signal(false);
    message = '';

    toggle() { this.open.update(v => !v); }

    send() {
        const text = this.message.trim();
        const base = 'https://wa.me/923001234567';
        const url = text ? `${base}?text=${encodeURIComponent(text)}` : base;
        window.open(url, '_blank', 'noopener,noreferrer');
        this.message = '';
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.send();
        }
    }

    autoResize(event: Event) {
        const el = event.target as HTMLTextAreaElement;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 100) + 'px';
    }
}
