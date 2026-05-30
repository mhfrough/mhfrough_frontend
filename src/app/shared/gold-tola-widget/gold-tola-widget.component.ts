import { Component, Input, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-gold-tola-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gold-tola-widget.component.html',
  styleUrls: ['./gold-tola-widget.component.scss'],
})
export class GoldTolaWidgetComponent implements OnInit {
  // Dummy inputs
  @Input() price = '200,000 PKR';
  @Input() label = 'Gold (tola)';
  @Input() key = '200000';

  displayKey = '';
  showDevControl = false;

  readonly PRICE_OPTIONS = [
    { key: '180000', label: '1 tola = 180,000 PKR', price: '180,000 PKR' },
    { key: '200000', label: '1 tola = 200,000 PKR', price: '200,000 PKR' },
    { key: '220000', label: '1 tola = 220,000 PKR', price: '220,000 PKR' },
  ] as const;

  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    this.displayKey = (this.key || '200000').toLowerCase().trim();
    if (isPlatformBrowser(this.platformId)) {
      try {
        const params = new URLSearchParams(window.location.search || '');
        this.showDevControl = params.has('goldDev') || params.get('goldDev') === '1';
      } catch {
        this.showDevControl = false;
      }
    }
    const found = this.PRICE_OPTIONS.find(o => o.key === this.displayKey);
    if (found) {
      this.price = found.price;
    }
  }

  onDevChange(val: string) {
    this.displayKey = (val || '200000').toLowerCase().trim();
    const found = this.PRICE_OPTIONS.find(o => o.key === this.displayKey);
    if (found) {
      this.price = found.price;
    }
  }

  get displayLabel(): string {
    return this.label;
  }

  formatCompact(value: string | number | null | undefined): string {
    let n = Number(value as any);
    if (!isFinite(n)) {
      // try to extract digits from strings like "200,000 PKR"
      const digits = String(value ?? '').replace(/[^0-9.-]/g, '');
      n = Number(digits);
      if (!isFinite(n)) return String(value ?? '');
    }
    try {
      return new Intl.NumberFormat('en', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(n as number);
    } catch {
      const abs = Math.abs(n);
      if (abs >= 1000000) return Math.round(n / 1000000) + 'M';
      if (abs >= 1000) return Math.round(n / 1000) + 'K';
      return String(Math.round(n));
    }
  }
}
