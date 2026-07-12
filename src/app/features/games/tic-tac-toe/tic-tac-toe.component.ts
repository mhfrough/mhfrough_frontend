import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

type Mark = 'X' | 'O' | null;

@Component({
    selector: 'app-tic-tac-toe',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './tic-tac-toe.component.html',
    styleUrl: './tic-tac-toe.component.scss',
})
export class TicTacToeComponent implements OnInit {
    private readonly seo = inject(SeoService);
    readonly board = signal<Mark[]>(Array(9).fill(null));
    readonly status = signal<'playing' | 'won' | 'draw'>('playing');
    readonly message = signal('Your turn');
    readonly playerWins = signal(0);
    readonly cpuWins = signal(0);
    private round = 0;

    ngOnInit(): void {
        this.seo.update({ title: 'Tic-Tac-Toe | Games | Mohammad Hamza', description: 'A quick monochrome game of Tic-Tac-Toe against the computer.', url: '/games/tic-tac-toe' });
    }

    play(index: number): void {
        if (this.status() !== 'playing' || this.board()[index]) return;
        this.place(index, 'X');
        if (this.finishTurn('X')) return;
        this.message.set('Thinking...');
        const round = this.round;
        setTimeout(() => { if (round === this.round) this.cpuTurn(); }, 280);
    }

    reset(): void { this.round++; this.board.set(Array(9).fill(null)); this.status.set('playing'); this.message.set('Your turn'); }

    private cpuTurn(): void {
        if (this.status() !== 'playing') return;
        const open = this.board().map((cell, index) => cell ? -1 : index).filter(index => index >= 0);
        const move = this.findMove('O', open) ?? this.findMove('X', open) ?? open[Math.floor(Math.random() * open.length)];
        this.place(move, 'O');
        if (!this.finishTurn('O')) this.message.set('Your turn');
    }

    private findMove(mark: Exclude<Mark, null>, open: number[]): number | null {
        for (const index of open) {
            const trial = [...this.board()];
            trial[index] = mark;
            if (this.winner(trial) === mark) return index;
        }
        return null;
    }

    private place(index: number, mark: Exclude<Mark, null>): void { const board = [...this.board()]; board[index] = mark; this.board.set(board); }

    private finishTurn(mark: Exclude<Mark, null>): boolean {
        if (this.winner(this.board()) === mark) {
            this.status.set('won');
            if (mark === 'X') this.playerWins.update(score => score + 1); else this.cpuWins.update(score => score + 1);
            this.message.set(mark === 'X' ? 'You win!' : 'CPU wins');
            return true;
        }
        if (this.board().every(Boolean)) { this.status.set('draw'); this.message.set('Draw game'); return true; }
        return false;
    }

    private winner(board: Mark[]): Exclude<Mark, null> | null {
        const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
        for (const [a, b, c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
        return null;
    }
}
