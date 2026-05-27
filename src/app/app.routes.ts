import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    // --- Admin portal FIRST (must come before the catch-all '' layout) -------
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
            {
                path: 'chat',
                loadComponent: () => import('./features/admin/chat/admin-chat.component').then(m => m.AdminChatComponent),
            },
            {
                path: 'push',
                loadComponent: () => import('./features/admin/push/admin-push.component').then(m => m.AdminPushComponent),
            },
            {
                path: 'notification-logs',
                loadComponent: () => import('./features/admin/notification-logs/admin-notification-logs.component').then(m => m.AdminNotificationLogsComponent),
            },
            {
                path: 'invoices',
                loadComponent: () => import('./features/admin/invoices/admin-invoices.component').then(m => m.AdminInvoicesComponent),
            },
            {
                path: 'invoices/new',
                loadComponent: () => import('./features/admin/invoices/admin-invoice-form/admin-invoice-form.component').then(m => m.AdminInvoiceFormComponent),
            },
            {
                path: 'invoices/:id/edit',
                loadComponent: () => import('./features/admin/invoices/admin-invoice-form/admin-invoice-form.component').then(m => m.AdminInvoiceFormComponent),
            },
            {
                path: 'invoices/:id',
                loadComponent: () => import('./features/admin/invoices/admin-invoice-view/admin-invoice-view.component').then(m => m.AdminInvoiceViewComponent),
            },
            {
                path: 'settings',
                redirectTo: 'settings/profile',
                pathMatch: 'full',
            },
            {
                path: 'settings/:tab',
                loadComponent: () => import('./features/admin/settings/admin-settings.component').then(m => m.AdminSettingsComponent),
            },
            {
                path: 'gallery',
                loadComponent: () => import('./features/admin/gallery/admin-gallery.component').then(m => m.AdminGalleryComponent),
            },
            { path: '**', redirectTo: 'dashboard', pathMatch: 'full' },
        ],
    },

    // --- Main site (wrapped in MainLayoutComponent) ---------------------------
    // '' prefix matches everything not already matched above.
    // The '**' child ensures unknown public URLs show the 404 page inside the layout.
    {
        path: '',
        loadComponent: () => import('./features/main/layout/main-layout.component').then(m => m.MainLayoutComponent),
        children: [
            {
                path: '',
                pathMatch: 'full',
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
                path: 'privacy',
                loadComponent: () => import('./features/main/privacy/privacy.component').then(m => m.PrivacyComponent),
            },
            {
                path: 'terms',
                loadComponent: () => import('./features/main/terms/terms.component').then(m => m.TermsComponent),
            },
            {
                path: 'projects',
                loadComponent: () => import('./features/main/projects/projects.component').then(m => m.ProjectsComponent),
            },
            {
                path: 'gallery',
                loadComponent: () => import('./features/main/gallery/gallery.component').then(m => m.GalleryComponent),
            },
            {
                path: 'projects/:slug',
                loadComponent: () => import('./features/main/projects/project-detail/project-detail.component').then(m => m.ProjectDetailComponent),
            },
            {
                path: 'not-found',
                loadComponent: () => import('./features/main/not-found/not-found.component').then(m => m.NotFoundComponent),
            },
            {
                path: '**',
                loadComponent: () => import('./features/main/not-found/not-found.component').then(m => m.NotFoundComponent),
            },
        ],
    },
];
