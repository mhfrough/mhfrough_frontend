import { Routes } from '@angular/router';

export const WHITEBOARD_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () => import('./layout/whiteboard-layout.component').then(m => m.WhiteboardLayoutComponent),
        children: [
            {
                path: '',
                loadComponent: () => import('./canvas/canvas-board.component').then(m => m.CanvasBoardComponent),
            },
        ],
    },
];
