import { Component, Input, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-usd-pkr-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './usd-pkr-widget.component.html',
  styleUrls: ['./usd-pkr-widget.component.scss'],
})
export class UsdPkrWidgetComponent implements OnInit {
  // Dummy inputs
  @Input() rate = '280 PKR';
  @Input() pair = 'USD → PKR';
  @Input() key = '280';

  displayKey = '';
  showDevControl = false;

  readonly RATE_OPTIONS = [
    { key: '280', label: '1 USD = 280 PKR', rate: '280 PKR' },
    { key: '285', label: '1 USD = 285 PKR', rate: '285 PKR' },
    { key: '290', label: '1 USD = 290 PKR', rate: '290 PKR' },
  ] as const;

  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    this.displayKey = (this.key || '280').toLowerCase().trim();
    if (isPlatformBrowser(this.platformId)) {
      try {
        const params = new URLSearchParams(window.location.search || '');
        this.showDevControl = params.has('currencyDev') || params.get('currencyDev') === '1';
      } catch {
        this.showDevControl = false;
      }
    }
    const found = this.RATE_OPTIONS.find(o => o.key === this.displayKey);
    if (found) {
      this.rate = found.rate;
    }
  }

  onDevChange(val: string) {
    this.displayKey = (val || '280').toLowerCase().trim();
    const found = this.RATE_OPTIONS.find(o => o.key === this.displayKey);
    if (found) {
      this.rate = found.rate;
    }
  }

  get displayLabel(): string {
    return this.pair;
  }
}
