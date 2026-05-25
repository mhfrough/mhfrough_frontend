import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    // --- Main site (wrapped in MainLayoutComponent) ---------------------------
    {
        path: '',
        loadComponent: () => import('./features/main/layout/main-layout.component').then(m => m.MainLayoutComponent),
        children: [
            {
                path: '',
                loadComponent: () => import('./features/main/home/home.component').then(m => m.HomeComponent),
            },
            {
                path: 'blog',
                loadComponent: () => import('./features/main/blog/blog-list/blog-list.component').then(m => m.BlogListComponent),
            },
            {
                path: 'blog/:slug',
                loadComponent: () => import('./features/main/blog/blog-detail/blog-detail.component').then(m => m.BlogDetailComponent),
            },
            {
                path: 'contact',
                loadComponent: () => import('./features/main/contact/contact.component').then(m => m.ContactComponent),
            },
            {
                path: 'feedback',
                loadComponent: () => import('./features/main/feedback/feedback.component').then(m => m.FeedbackComponent),
            },
            {
                path: 'brand',
                loadComponent: () => import('./features/main/brand/brand.component').then(m => m.BrandComponent),
            },
        ],
    },

    // --- Admin portal (completely separate, own layout) ----------------------
    {
        path: 'admin/login',
        loadComponent: () => import('./features/admin/login/admin-login.component').then(m => m.AdminLoginComponent),
    },
    {
        path: 'admin',
        canActivate: [authGuard],
        loadComponent: () => import('./features/admin/layout/admin-layout.component').then(m => m.AdminLayoutComponent),
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            {
                path: 'dashboard',
                loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
            },
            {
                path: 'projects',
                loadComponent: () => import('./features/admin/projects/admin-projects.component').then(m => m.AdminProjectsComponent),
            },
            {
                path: 'blogs',
                loadComponent: () => import('./features/admin/blogs/admin-blogs.component').then(m => m.AdminBlogsComponent),
            },
            {
                path: 'inquiries',
                loadComponent: () => import('./features/admin/inquiries/admin-inquiries.component').then(m => m.AdminInquiriesComponent),
            },
            {
                path: 'feedback',
                loadComponent: () => import('./features/admin/feedback/admin-feedback.component').then(m => m.AdminFeedbackComponent),
            },
            {
                path: 'comments',
                loadComponent: () => import('./features/admin/comments/admin-comments.component').then(m => m.AdminCommentsComponent),
            },
        ],
    },

    { path: '**', redirectTo: '' },
];
