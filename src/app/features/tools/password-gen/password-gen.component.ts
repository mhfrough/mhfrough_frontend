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

type Mode = 'password' | 'passphrase';
type Separator = '-' | '.' | ' ' | '_';

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

    // --- Mode ----------------------------------------------------------------
    readonly mode = signal<Mode>('password');

    // --- Generate options (password mode) ------------------------------------
    readonly length = signal(20);
    readonly useUpper = signal(true);
    readonly useLower = signal(true);
    readonly useDigits = signal(true);
    readonly useSymbols = signal(true);
    readonly excludeAmbiguous = signal(false);

    // --- Passphrase options ----------------------------------------------------
    readonly wordCount = signal(5);
    readonly separator = signal<Separator>('-');
    readonly capitalizeWords = signal(false);
    readonly appendNumber = signal(false);

    readonly separators: { value: Separator; label: string }[] = [
        { value: '-', label: '-' },
        { value: '.', label: '.' },
        { value: ' ', label: 'space' },
        { value: '_', label: '_' },
    ];

    // A compact, embedded word list — short, common English words only.
    private readonly WORDS: readonly string[] = [
        'able', 'acid', 'aged', 'also', 'area', 'army', 'away', 'baby', 'back', 'ball',
        'band', 'bank', 'base', 'bath', 'bear', 'beat', 'been', 'beer', 'bell', 'belt',
        'best', 'bike', 'bird', 'blue', 'boat', 'body', 'bomb', 'bond', 'bone', 'book',
        'boom', 'born', 'boss', 'both', 'bowl', 'bulk', 'burn', 'bush', 'busy', 'cake',
        'call', 'calm', 'came', 'camp', 'card', 'care', 'case', 'cash', 'cast', 'cave',
        'cell', 'chat', 'chip', 'city', 'club', 'coal', 'coat', 'code', 'cold', 'come',
        'cook', 'cool', 'cope', 'copy', 'core', 'cost', 'crew', 'crop', 'dark', 'data',
        'date', 'dawn', 'days', 'dead', 'deal', 'dean', 'dear', 'debt', 'deep', 'deny',
        'desk', 'dial', 'diet', 'disc', 'disk', 'does', 'done', 'door', 'dose', 'down',
        'draw', 'drop', 'drug', 'dual', 'duke', 'dust', 'duty', 'each', 'earn', 'ease',
        'east', 'easy', 'edge', 'else', 'even', 'ever', 'evil', 'exit', 'face', 'fact',
        'fail', 'fair', 'fall', 'farm', 'fast', 'fate', 'fear', 'feed', 'feel', 'file',
        'fill', 'film', 'find', 'fine', 'fire', 'firm', 'fish', 'five', 'flat', 'flow',
        'food', 'foot', 'fork', 'form', 'fort', 'four', 'free', 'from', 'fuel', 'full',
        'fund', 'gain', 'game', 'gate', 'gave', 'gear', 'gene', 'gift', 'girl', 'give',
        'glad', 'goal', 'goes', 'gold', 'golf', 'gone', 'good', 'gray', 'grew', 'grey',
        'grid', 'grow', 'gulf', 'hair', 'half', 'hall', 'hand', 'hang', 'hard', 'harm',
        'hate', 'have', 'head', 'hear', 'heat', 'held', 'hell', 'help', 'here', 'hero',
        'high', 'hill', 'hire', 'hold', 'hole', 'holy', 'home', 'hope', 'horn', 'host',
        'hour', 'huge', 'hung', 'hunt', 'hurt', 'idea', 'inch', 'into', 'iron', 'item',
        'jazz', 'join', 'joke', 'jump', 'jury', 'just', 'keen', 'keep', 'kept', 'kick',
        'kind', 'king', 'knee', 'knew', 'lack', 'lady', 'lake', 'land', 'lane', 'last',
        'late', 'lead', 'leaf', 'lean', 'left', 'less', 'life', 'lift', 'like', 'line',
        'link', 'list', 'live', 'load', 'loan', 'lock', 'logo', 'long', 'look', 'lord',
        'lose', 'loss', 'lost', 'love', 'luck', 'made', 'mail', 'main', 'make', 'many',
        'mark', 'mask', 'mass', 'meal', 'mean', 'meat', 'meet', 'menu', 'mere', 'mesh',
        'mild', 'mile', 'milk', 'mind', 'mine', 'miss', 'mode', 'mood', 'moon', 'more',
        'most', 'move', 'much', 'must', 'name', 'navy', 'near', 'neck', 'need', 'news',
        'next', 'nice', 'nine', 'none', 'norm', 'nose', 'note', 'okay', 'once', 'only',
        'onto', 'open', 'oral', 'over', 'pace', 'pack', 'page', 'paid', 'pain', 'pair',
        'palm', 'park', 'part', 'pass', 'past', 'path', 'peak', 'pick', 'pile', 'pine',
        'pink', 'pipe', 'plan', 'play', 'plot', 'plug', 'plus', 'poll', 'pool', 'poor',
    ];

    readonly password = signal('');
    readonly copied = signal(false);

    // --- Batch generate --------------------------------------------------------
    readonly batchResults = signal<string[]>([]);
    readonly batchCopiedIndex = signal<number | null>(null);

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

    private generatePassword(): string {
        const pool = this.buildPool();
        if (!pool) return '';
        const len = Math.max(8, Math.min(64, Math.floor(Number(this.length()) || 8)));
        let out = '';
        for (let i = 0; i < len; i++) {
            out += pool[this.randomInt(pool.length)];
        }
        return out;
    }

    private generatePassphrase(): string {
        const count = Math.max(3, Math.min(8, Math.floor(Number(this.wordCount()) || 5)));
        const words: string[] = [];
        for (let i = 0; i < count; i++) {
            let w = this.WORDS[this.randomInt(this.WORDS.length)];
            if (this.capitalizeWords()) w = w.charAt(0).toUpperCase() + w.slice(1);
            words.push(w);
        }
        let out = words.join(this.separator());
        if (this.appendNumber()) {
            out += this.separator() + String(this.randomInt(10000));
        }
        return out;
    }

    /** Generate one value for whichever mode is currently active. */
    private generateOne(): string {
        return this.mode() === 'passphrase' ? this.generatePassphrase() : this.generatePassword();
    }

    setMode(mode: Mode): void {
        this.mode.set(mode);
        this.batchResults.set([]);
        if (isPlatformBrowser(this.platformId)) this.regenerate(false);
    }

    /** Generate a new password/passphrase. `report` records explicit user-triggered runs. */
    regenerate(report = true): void {
        const out = this.generateOne();
        this.password.set(out);
        if (report) {
            this.api.reportUsage({ toolId: 'password-gen', action: 'generate', metadata: { mode: this.mode() } });
        }
    }

    /** Generate a batch of 5 values for whichever mode is active. */
    generateBatch(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const results: string[] = [];
        for (let i = 0; i < 5; i++) results.push(this.generateOne());
        this.batchResults.set(results);
        this.batchCopiedIndex.set(null);
        this.api.reportUsage({ toolId: 'password-gen', action: 'batch', metadata: { mode: this.mode() } });
    }

    /** Use a batch entry as the "current" value for hashing. */
    useForHash(value: string): void {
        this.password.set(value);
        this.hashResult.set(null);
        this.hashError.set(null);
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

    async copyBatchItem(value: string, index: number): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        if (await copyText(value)) {
            this.batchCopiedIndex.set(index);
            setTimeout(() => {
                if (this.batchCopiedIndex() === index) this.batchCopiedIndex.set(null);
            }, 1400);
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
