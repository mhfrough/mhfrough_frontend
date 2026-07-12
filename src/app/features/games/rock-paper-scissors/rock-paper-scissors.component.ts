import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

type Choice = 'Rock' | 'Paper' | 'Scissors';
const CHOICES: Choice[] = ['Rock', 'Paper', 'Scissors'];

@Component({
    selector: 'app-rock-paper-scissors',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './rock-paper-scissors.component.html',
    styleUrl: './rock-paper-scissors.component.scss',
})
export class RockPaperScissorsComponent implements OnInit {
    private readonly seo = inject(SeoService);
    readonly playerScore = signal(0);
    readonly cpuScore = signal(0);
    readonly playerChoice = signal<Choice | null>(null);
    readonly cpuChoice = signal<Choice | null>(null);
    readonly result = signal('Pick your move');
    readonly choices = CHOICES;

    ngOnInit(): void { this.seo.update({ title: 'Rock Paper Scissors | Games | Mohammad Hamza', description: 'A fast, monochrome round of Rock Paper Scissors against the computer.', url: '/games/rock-paper-scissors' }); }

    play(choice: Choice): void {
        const cpu = CHOICES[Math.floor(Math.random() * CHOICES.length)];
        this.playerChoice.set(choice);
        this.cpuChoice.set(cpu);
        if (choice === cpu) { this.result.set('Draw — go again'); return; }
        const playerWins = (choice === 'Rock' && cpu === 'Scissors') || (choice === 'Paper' && cpu === 'Rock') || (choice === 'Scissors' && cpu === 'Paper');
        if (playerWins) { this.playerScore.update(score => score + 1); this.result.set('You win this round'); }
        else { this.cpuScore.update(score => score + 1); this.result.set('CPU wins this round'); }
    }

    reset(): void { this.playerScore.set(0); this.cpuScore.set(0); this.playerChoice.set(null); this.cpuChoice.set(null); this.result.set('Pick your move'); }
}
