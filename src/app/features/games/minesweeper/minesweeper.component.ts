import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

interface Cell {
    mine: boolean;
    revealed: boolean;
    flagged: boolean;
    adjacent: number;
}

const ROWS = 9;
const COLS = 9;
const MINES = 10;

@Component({
    selector: 'app-minesweeper',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './minesweeper.component.html',
    styleUrl: './minesweeper.component.scss',
})
export class MinesweeperComponent implements OnInit, OnDestroy {
    private readonly seo = inject(SeoService);

    readonly grid = signal<Cell[][]>(this.emptyGrid());
    readonly status = signal<'idle' | 'playing' | 'won' | 'lost'>('idle');
    readonly seconds = signal(0);
    readonly minesLeft = computed(() => {
        const flagged = this.grid().flat().filter(c => c.flagged).length;
        return MINES - flagged;
    });

    private minesPlaced = false;
    private timerHandle: ReturnType<typeof setInterval> | null = null;

    ngOnInit(): void {
        this.seo.update({
            title: 'Minesweeper | Games | Mohammad Hamza',
            description: 'A monochrome Minesweeper board, right in the browser. Clear the grid without hitting a mine.',
            url: '/games/minesweeper',
        });
    }

    ngOnDestroy(): void {
        this.stopTimer();
    }

    private emptyGrid(): Cell[][] {
        return Array.from({ length: ROWS }, () =>
            Array.from({ length: COLS }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })),
        );
    }

    newGame() {
        this.stopTimer();
        this.grid.set(this.emptyGrid());
        this.status.set('idle');
        this.seconds.set(0);
        this.minesPlaced = false;
    }

    private startTimer() {
        this.stopTimer();
        this.timerHandle = setInterval(() => this.seconds.update(v => v + 1), 1000);
    }

    private stopTimer() {
        if (this.timerHandle !== null) {
            clearInterval(this.timerHandle);
            this.timerHandle = null;
        }
    }

    private placeMines(safeR: number, safeC: number) {
        const grid = this.grid().map(row => row.map(c => ({ ...c })));
        let placed = 0;
        while (placed < MINES) {
            const r = Math.floor(Math.random() * ROWS);
            const c = Math.floor(Math.random() * COLS);
            if (grid[r][c].mine) continue;
            if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
            grid[r][c].mine = true;
            placed++;
        }
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c].mine) continue;
                grid[r][c].adjacent = this.neighbors(r, c).filter(([nr, nc]) => grid[nr][nc].mine).length;
            }
        }
        this.grid.set(grid);
        this.minesPlaced = true;
    }

    private neighbors(r: number, c: number): [number, number][] {
        const out: [number, number][] = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) out.push([nr, nc]);
            }
        }
        return out;
    }

    reveal(r: number, c: number) {
        if (this.status() === 'won' || this.status() === 'lost') return;
        if (this.grid()[r][c].flagged) return;

        if (!this.minesPlaced) {
            this.placeMines(r, c);
            this.status.set('playing');
            this.startTimer();
        }

        const grid = this.grid().map(row => row.map(c => ({ ...c })));
        if (grid[r][c].revealed) return;

        if (grid[r][c].mine) {
            grid.forEach(row => row.forEach(cell => { if (cell.mine) cell.revealed = true; }));
            this.grid.set(grid);
            this.status.set('lost');
            this.stopTimer();
            return;
        }

        this.floodReveal(grid, r, c);
        this.grid.set(grid);
        this.checkWin(grid);
    }

    private floodReveal(grid: Cell[][], r: number, c: number) {
        const stack: [number, number][] = [[r, c]];
        while (stack.length) {
            const [cr, cc] = stack.pop()!;
            const cell = grid[cr][cc];
            if (cell.revealed || cell.flagged) continue;
            cell.revealed = true;
            if (cell.adjacent === 0) {
                for (const [nr, nc] of this.neighbors(cr, cc)) {
                    if (!grid[nr][nc].revealed && !grid[nr][nc].mine) stack.push([nr, nc]);
                }
            }
        }
    }

    private checkWin(grid: Cell[][]) {
        const cleared = grid.flat().every(cell => cell.mine || cell.revealed);
        if (cleared) {
            this.status.set('won');
            this.stopTimer();
            grid.forEach(row => row.forEach(cell => { if (cell.mine) cell.flagged = true; }));
            this.grid.set(grid);
        }
    }

    toggleFlag(e: Event, r: number, c: number) {
        e.preventDefault();
        if (this.status() === 'won' || this.status() === 'lost') return;
        const grid = this.grid().map(row => row.map(c => ({ ...c })));
        if (grid[r][c].revealed) return;
        grid[r][c].flagged = !grid[r][c].flagged;
        this.grid.set(grid);
    }

    cellLabel(cell: Cell): string {
        if (cell.flagged) return '⚑';
        if (!cell.revealed) return '';
        if (cell.mine) return '✹';
        return cell.adjacent ? String(cell.adjacent) : '';
    }
}
