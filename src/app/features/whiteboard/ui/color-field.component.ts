import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/** Reusable swatch row + native color picker. Emits the chosen color string. */
@Component({
    selector: 'app-color-field',
    standalone: true,
    imports: [],
    templateUrl: './color-field.component.html',
    styleUrl: './color-field.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorFieldComponent {
    @Input({ required: true }) swatches: readonly string[] = [];
    @Input() value: string | null = null;
    @Input() allowTransparent = false;
    @Output() readonly colorChange = new EventEmitter<string>();

    pick(color: string): void {
        this.colorChange.emit(color);
    }

    onCustom(event: Event): void {
        this.colorChange.emit((event.target as HTMLInputElement).value);
    }

    isTransparent(color: string): boolean {
        return color === 'transparent';
    }
}
