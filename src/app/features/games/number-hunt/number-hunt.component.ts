import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

@Component({
    selector: 'app-number-hunt',
    standalone: true,
    imports: [FormsModule, RouterLink],
    templateUrl: './number-hunt.component.html',
    styleUrl: './number-hunt.component.scss',
})
export class NumberHuntComponent implements OnInit {
    private readonly seo = inject(SeoService);
    readonly attempts = signal(0);
    readonly best = signal<number | null>(null);
    readonly message = signal('Find the number from 1 to 100');
    readonly won = signal(false);
    guess = '';
    private target = this.nextTarget();

    ngOnInit(): void { this.seo.update({ title: 'Number Hunt | Games | Mohammad Hamza', description: 'Guess the hidden number in this minimal browser arcade game.', url: '/games/number-hunt' }); }

    submit(): void {
        const value = Number(this.guess);
        if (!Number.isInteger(value) || value < 1 || value > 100 || this.won()) { this.message.set('Enter a whole number from 1 to 100'); return; }
        this.attempts.update(count => count + 1);
        this.guess = '';
        if (value === this.target) {
            this.won.set(true);
            if (this.best() === null || this.attempts() < this.best()!) this.best.set(this.attempts());
            this.message.set(`Correct in ${this.attempts()} tries!`);
        } else this.message.set(value < this.target ? 'Too low — try higher' : 'Too high — try lower');
    }

    reset(): void { this.target = this.nextTarget(); this.attempts.set(0); this.guess = ''; this.won.set(false); this.message.set('Find the number from 1 to 100'); }
    private nextTarget(): number { return Math.floor(Math.random() * 100) + 1; }
}
