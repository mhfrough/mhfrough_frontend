import { Component, Input, inject } from '@angular/core';
import { WidgetService, GoldData } from '../../core/services/widget.service';

@Component({
    selector: 'app-gold-tola-widget',
    standalone: true,
    imports: [],
    templateUrl: './gold-tola-widget.component.html',
    styleUrls: ['./gold-tola-widget.component.scss'],
})
export class GoldTolaWidgetComponent {
    @Input() goldData: GoldData | null = null;

    readonly widgetService = inject(WidgetService);

    get data(): GoldData | null {
        return this.goldData ?? this.widgetService.goldData();
    }

    get displayPrice(): string {
        const d = this.data;
        if (!d || d.pricePerTola == null) return '—';
        return `${this.widgetService.formatCompact(d.pricePerTola)} PKR`;
    }
}
