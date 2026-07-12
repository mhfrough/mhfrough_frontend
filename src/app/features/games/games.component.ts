import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

interface GameCard {
    slug: string;
    title: string;
    tagline: string;
    keys: string;
}

@Component({
    selector: 'app-games',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './games.component.html',
    styleUrl: './games.component.scss',
})
export class GamesComponent implements OnInit {
    private readonly seo = inject(SeoService);

    readonly games: GameCard[] = [
        { slug: 'snake', title: 'Snake', tagline: 'Classic grid snake. Eat, grow, don’t bite yourself.', keys: 'ARROWS / WASD' },
        { slug: 'ping-pong', title: 'Ping Pong', tagline: 'Solo vs. the CPU, or flip to 2P and share the keyboard. First to 7 wins.', keys: '1P OR 2P' },
        { slug: '2048', title: '2048', tagline: 'Slide and merge tiles until you hit 2048.', keys: 'ARROWS / WASD' },
        { slug: 'breakout', title: 'Breakout', tagline: 'Paddle, ball, bricks. Clear the wall without dropping it.', keys: 'ARROWS / A-D' },
        { slug: 'space-invaders', title: 'Space Invaders', tagline: 'Clear the wave before it reaches you.', keys: 'ARROWS + SPACE' },
        { slug: 'tetris', title: 'Tetris', tagline: 'Stack, rotate, clear lines. Don’t top out.', keys: 'ARROWS + SPACE' },
        { slug: 'minesweeper', title: 'Minesweeper', tagline: 'Clear the grid without hitting a mine.', keys: 'CLICK / RIGHT-CLICK' },
        { slug: 'memory', title: 'Memory', tagline: 'Watch the sequence, then repeat it back.', keys: 'CLICK / TAP' },
        { slug: 'tic-tac-toe', title: 'Tic-Tac-Toe', tagline: 'Take on the CPU in the timeless three-in-a-row showdown.', keys: 'CLICK / TAP' },
        { slug: 'rock-paper-scissors', title: 'Rock Paper Scissors', tagline: 'Pick a move, beat the CPU, settle the score.', keys: 'CLICK / TAP' },
        { slug: 'number-hunt', title: 'Number Hunt', tagline: 'Track down the hidden number in the fewest guesses.', keys: 'KEYBOARD / TAP' },
    ];

    ngOnInit(): void {
        this.seo.update({
            title: 'Games | Mohammad Hamza',
            description: 'A collection of tiny retro, Nokia-3310-style browser games.',
            url: '/games',
        });
    }
}
