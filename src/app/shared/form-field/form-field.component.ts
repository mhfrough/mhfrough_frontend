import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, AbstractControl } from '@angular/forms';

@Component({
    selector: 'app-form-field',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './form-field.component.html',
    styleUrls: ['./form-field.component.scss'],
})
export class FormFieldComponent {
    @Input() label = '';
    @Input() required = false;
    @Input() optional = false;
    @Input() control: AbstractControl | null = null;
    @Input() type = 'text';
    @Input() maxlength?: number;

    // expose Math to the template (templates can't access global Math directly)
    readonly Math = Math;

    get showError(): boolean {
        return !!(this.control && this.control.invalid && (this.control.touched || this.control.dirty));
    }

    get remainingChars(): number | null {
        if (!this.maxlength || !this.control) return this.maxlength ?? null;
        const val = String(this.control.value ?? '');
        return this.maxlength - val.length;
    }
}
