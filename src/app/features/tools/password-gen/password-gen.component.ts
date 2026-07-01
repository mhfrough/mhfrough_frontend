import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../../../core/services/seo.service';
import { ToolsApiService, HashAlgorithm } from '../tools-api.service';
import { ToolPageComponent } from '../shared/tool-page.component';
import { copyText } from '../shared/clipboard.util';

interface Strength {
    label: string;
    level: 0 | 1 | 2 | 3 | 4;
}

@Component({
    selector: 'app-password-gen',
    standalone: true,
    imports: [CommonModule, FormsModule, ToolPageComponent],
    templateUrl: './password-gen.component.html',
    styleUrl: './password-gen.component.scss',
})
export class PasswordGenComponent implements OnInit {
    private readonly seo = inject(SeoService);
    private readonly api = inject(ToolsApiService);
    private readonly platformId = inject(PLATFORM_ID);

    // --- Generate options --------------------------------------------------
    readonly length = signal(20);
    readonly useUpper = signal(true);
    readonly useLower = signal(true);
    readonly useDigits = signal(true);
    readonly useSymbols = signal(true);
    readonly excludeAmbiguous = signal(false);

    readonly password = signal('');
    readonly copied = signal(false);

    // --- Hash panel (backend) ----------------------------------------------
    readonly showHash = signal(false);
    readonly hashAlgorithm = signal<HashAlgorithm>('bcrypt');
    readonly rounds = signal(10);
    readonly hashLoading = signal(false);
    readonly hashError = signal<string | null>(null);
    readonly hashResult = signal<string | null>(null);
    readonly hashCopied = signal(false);

    readonly hashAlgorithms: HashAlgorithm[] = ['bcrypt', 'md5', 'sha1', 'sha256', 'sha512'];

    private readonly UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    private readonly LOWER = 'abcdefghijklmnopqrstuvwxyz';
    private readonly DIGITS = '0123456789';
    private readonly SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?';
    private readonly AMBIGUOUS = 'O0oIl1|`';

    readonly strength = computed<Strength>(() => {
        const pw = this.password();
        if (!pw) return { label: 'No password', level: 0 };
        let variety = 0;
        if (/[A-Z]/.test(pw)) variety++;
        if (/[a-z]/.test(pw)) variety++;
        if (/[0-9]/.test(pw)) variety++;
        if (/[^A-Za-z0-9]/.test(pw)) variety++;
        const len = pw.length;
        let score = 0;
        if (len >= 8) score++;
        if (len >= 12) score++;
        if (len >= 16) score++;
        score += variety - 1;
        const level = Math.max(1, Math.min(4, score)) as 1 | 2 | 3 | 4;
        const labels: Record<number, string> = {
            1: 'Weak',
            2: 'Fair',
            3: 'Strong',
            4: 'Very strong',
        };
        return { label: labels[level], level };
    });

    ngOnInit(): void {
        this.seo.update({
            title: 'Password Generator | Dev Tools',
            description:
                'Generate strong, random passwords with full control over length and character sets, then optionally hash them with bcrypt or SHA.',
            url: '/tools/password-gen',
            keywords: 'password generator, random password, strong password, bcrypt, password hash',
        });
        if (isPlatformBrowser(this.platformId)) this.regenerate(false);
    }

    private randomInt(max: number): number {
        if (isPlatformBrowser(this.platformId) && typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const arr = new Uint32Array(1);
            // Rejection sampling to avoid modulo bias.
            const limit = Math.floor(0xffffffff / max) * max;
            let x = 0;
            do {
                crypto.getRandomValues(arr);
                x = arr[0];
            } while (x >= limit);
            return x % max;
        }
        return Math.floor(Math.random() * max);
    }

    private buildPool(): string {
        let pool = '';
        if (this.useUpper()) pool += this.UPPER;
        if (this.useLower()) pool += this.LOWER;
        if (this.useDigits()) pool += this.DIGITS;
        if (this.useSymbols()) pool += this.SYMBOLS;
        if (this.excludeAmbiguous()) {
            pool = pool.split('').filter(c => !this.AMBIGUOUS.includes(c)).join('');
        }
        return pool;
    }

    /** Generate a new password. `report` records explicit user-triggered runs. */
    regenerate(report = true): void {
        const pool = this.buildPool();
        if (!pool) {
            this.password.set('');
            return;
        }
        const len = Math.max(8, Math.min(64, Math.floor(Number(this.length()) || 8)));
        let out = '';
        for (let i = 0; i < len; i++) {
            out += pool[this.randomInt(pool.length)];
        }
        this.password.set(out);
        if (report) {
            this.api.reportUsage({ toolId: 'password-gen', action: 'generate', metadata: { length: len } });
        }
    }

    async copyPassword(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const pw = this.password();
        if (!pw) return;
        if (await copyText(pw)) {
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 1400);
            this.api.reportUsage({ toolId: 'password-gen', action: 'copy' });
        }
    }

    // --- Hash --------------------------------------------------------------
    hash(): void {
        const pw = this.password();
        if (!pw) {
            this.hashError.set('Generate a password to hash first.');
            return;
        }
        this.hashLoading.set(true);
        this.hashError.set(null);
        this.hashResult.set(null);

        const algorithm = this.hashAlgorithm();
        this.api.passwordHash({
            password: pw,
            algorithm,
            ...(algorithm === 'bcrypt' ? { rounds: Math.max(4, Math.min(15, Number(this.rounds()) || 10)) } : {}),
        }).subscribe({
            next: (res) => {
                this.hashResult.set(res.hash);
                this.hashLoading.set(false);
                this.api.reportUsage({ toolId: 'password-gen', action: 'hash', metadata: { algorithm } });
            },
            error: (err) => {
                this.hashLoading.set(false);
                this.hashError.set(err?.error?.message ?? 'Hashing failed. Try again.');
            },
        });
    }

    async copyHash(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        const h = this.hashResult();
        if (!h) return;
        if (await copyText(h)) {
            this.hashCopied.set(true);
            setTimeout(() => this.hashCopied.set(false), 1400);
            this.api.reportUsage({ toolId: 'password-gen', action: 'copy-hash' });
        }
    }
}
