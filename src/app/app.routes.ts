import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'contact',
    loadComponent: () => import('./features/contact/contact.component').then(m => m.ContactComponent),
  },
  {
    path: 'feedback',
    loadComponent: () => import('./features/feedback/feedback.component').then(m => m.FeedbackComponent),
  },
  {
    path: 'blog',
    loadComponent: () => import('./features/blog/blog-list/blog-list.component').then(m => m.BlogListComponent),
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./features/blog/blog-detail/blog-detail.component').then(m => m.BlogDetailComponent),
  },
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
    ],
  },
  { path: '**', redirectTo: '' },
];
