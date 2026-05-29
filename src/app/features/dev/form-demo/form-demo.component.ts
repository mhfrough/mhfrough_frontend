import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { FormFieldComponent } from '../../../shared/form-field/form-field.component';

@Component({
    selector: 'app-form-demo',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormFieldComponent],
    templateUrl: './form-demo.component.html',
    styleUrl: './form-demo.component.scss',
})
export class FormDemoComponent implements OnInit {
    form!: FormGroup;

    ngOnInit(): void {
        this.form = new FormGroup({
            name: new FormControl('', Validators.required),
            email: new FormControl('', [Validators.required, Validators.email]),
            age: new FormControl('', Validators.pattern(/^\d+$/)),
            message: new FormControl('', Validators.maxLength(500)),
        });
    }

    submit(): void {
        if (this.form.valid) {
            console.log('Form submitted', this.form.value);
            alert('Form submitted (see console)');
            this.form.reset();
        } else {
            this.form.markAllAsTouched();
        }
    }
}
