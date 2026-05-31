import { Component, Input, inject } from '@angular/core';
import { WidgetService, UsdPkrData } from '../../../core/services/widget.service';

@Component({
  selector: 'app-usd-pkr-widget',
  standalone: true,
  imports: [],
  templateUrl: './usd-pkr-widget.component.html',
  styleUrls: ['./usd-pkr-widget.component.scss'],
})
export class UsdPkrWidgetComponent {
  @Input() usdPkrData: UsdPkrData | null = null;

  readonly widgetService = inject(WidgetService);

  get data(): UsdPkrData | null {
    return this.usdPkrData ?? this.widgetService.usdPkrData();
  }

  get displayRate(): string {
    const d = this.data;
    return d ? `${d.rate} PKR` : '—';
  }
}
