import { Component, inject, signal, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-admin-login',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './admin-login.component.html',
})
export class AdminLoginComponent {
    @HostBinding('attr.data-bs-theme') readonly darkTheme = 'dark';
    private auth = inject(AuthService);
    private router = inject(Router);
    readonly loading = signal(false);
    readonly error = signal('');
    readonly showPassword = signal(false);

    login(form: NgForm) {
        if (form.invalid) return;
        this.loading.set(true);
        this.error.set('');
        this.auth.login(form.value.email, form.value.password).subscribe({
            next: () => this.router.navigate(['/admin']),
            error: () => { this.error.set('Invalid credentials.'); this.loading.set(false); },
        });
    }
}
