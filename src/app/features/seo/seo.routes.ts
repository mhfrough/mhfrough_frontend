import { Routes } from '@angular/router';

export const SEO_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () => import('./layout/seo-layout.component').then(m => m.SeoLayoutComponent),
        children: [
            {
                path: '',
                loadComponent: () => import('./audit/seo-audit.component').then(m => m.SeoAuditComponent),
            },
            { path: '**', redirectTo: '' },
        ],
    },
];
