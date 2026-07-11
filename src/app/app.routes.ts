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
                path: 'projects/new',
                loadComponent: () => import('./features/admin/projects/admin-project-form/admin-project-form.component').then(m => m.AdminProjectFormComponent),
            },
            {
                path: 'projects/:id/edit',
                loadComponent: () => import('./features/admin/projects/admin-project-form/admin-project-form.component').then(m => m.AdminProjectFormComponent),
            },
            {
                path: 'blogs',
                loadComponent: () => import('./features/admin/blogs/admin-blogs.component').then(m => m.AdminBlogsComponent),
            },
            {
                path: 'blogs/new',
                loadComponent: () => import('./features/admin/blogs/admin-blog-form/admin-blog-form.component').then(m => m.AdminBlogFormComponent),
            },
            {
                path: 'blogs/:id/edit',
                loadComponent: () => import('./features/admin/blogs/admin-blog-form/admin-blog-form.component').then(m => m.AdminBlogFormComponent),
            },
            {
                path: 'leads',
                loadComponent: () => import('./features/admin/leads/admin-leads.component').then(m => m.AdminLeadsComponent),
            },
            {
                path: 'leads/new',
                loadComponent: () => import('./features/admin/leads/admin-lead-detail/admin-lead-detail.component').then(m => m.AdminLeadDetailComponent),
            },
            {
                path: 'leads/pipeline',
                loadComponent: () => import('./features/admin/leads/admin-leads-pipeline.component').then(m => m.AdminLeadsPipelineComponent),
            },
            {
                path: 'leads/:id',
                loadComponent: () => import('./features/admin/leads/admin-lead-detail/admin-lead-detail.component').then(m => m.AdminLeadDetailComponent),
            },
            {
                path: 'feedback',
                loadComponent: () => import('./features/admin/feedback/admin-feedback.component').then(m => m.AdminFeedbackComponent),
            },
            {
                path: 'blogs/comments',
                loadComponent: () => import('./features/admin/comments/admin-comments.component').then(m => m.AdminCommentsComponent),
            },
            {
                path: 'chat',
                loadComponent: () => import('./features/admin/chat/admin-chat.component').then(m => m.AdminChatComponent),
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
                path: 'insights',
                redirectTo: 'insights/visitors',
                pathMatch: 'full',
            },
            {
                path: 'insights/:tab',
                loadComponent: () => import('./features/admin/insights/admin-insights.component').then(m => m.AdminInsightsComponent),
            },
            {
                path: 'appointments',
                loadComponent: () => import('./features/admin/appointments/admin-appointments.component').then(m => m.AdminAppointmentsComponent),
            },
            {
                path: 'gallery',
                loadComponent: () => import('./features/admin/gallery/admin-gallery.component').then(m => m.AdminGalleryComponent),
            },
            {
                path: 'gallery/new',
                loadComponent: () => import('./features/admin/gallery/admin-gallery-form/admin-gallery-form.component').then(m => m.AdminGalleryFormComponent),
            },
            {
                path: 'gallery/:id/edit',
                loadComponent: () => import('./features/admin/gallery/admin-gallery-form/admin-gallery-form.component').then(m => m.AdminGalleryFormComponent),
            },
            {
                path: 'email',
                loadComponent: () => import('./features/admin/email/admin-email.component').then(m => m.AdminEmailComponent),
            },
            { path: '**', redirectTo: 'dashboard', pathMatch: 'full' },
        ],
    },

    // --- Whiteboard (own layout/chrome, before the catch-all '') --------------
    {
        path: 'whiteboard',
        loadChildren: () => import('./features/whiteboard/whiteboard.routes').then(m => m.WHITEBOARD_ROUTES),
    },

    // --- Standalone SEO audit suite (own layout/chrome) -----------------------
    {
        path: 'seo',
        loadChildren: () => import('./features/seo/seo.routes').then(m => m.SEO_ROUTES),
    },

    // --- Public dev-tools (own layout/chrome, before the catch-all '') --------
    {
        path: 'tools',
        loadComponent: () => import('./features/tools/layout/tools-layout.component').then(m => m.ToolsLayoutComponent),
        children: [
            {
                path: '',
                loadComponent: () => import('./features/tools/landing/tools-landing.component').then(m => m.ToolsLandingComponent),
            },
            // --- Live tools (each merges its former near-duplicate siblings) ----
            {
                path: 'css-units',
                loadComponent: () => import('./features/tools/unit-converter/unit-converter.component').then(m => m.UnitConverterComponent),
            },
            {
                path: 'minify',
                loadComponent: () => import('./features/tools/minify/minify.component').then(m => m.MinifyComponent),
            },
            {
                path: 'css-scss',
                loadComponent: () => import('./features/tools/css-scss/css-scss.component').then(m => m.CssScssComponent),
            },
            {
                path: 'image-format',
                loadComponent: () => import('./features/tools/image-format/image-format.component').then(m => m.ImageFormatComponent),
            },
            {
                path: 'image-upscale',
                loadComponent: () => import('./features/tools/image-upscale/image-upscale.component').then(m => m.ImageUpscaleComponent),
            },
            {
                path: 'favicon',
                loadComponent: () => import('./features/tools/favicon-ico/favicon-ico.component').then(m => m.FaviconIcoComponent),
            },
            {
                path: 'social-post',
                loadComponent: () => import('./features/tools/social-post/social-post.component').then(m => m.SocialPostComponent),
            },
            {
                path: 'text-image',
                loadComponent: () => import('./features/tools/text-image/text-image.component').then(m => m.TextImageComponent),
            },
            {
                path: 'whatsapp-format',
                loadComponent: () => import('./features/tools/whatsapp-format/whatsapp-format.component').then(m => m.WhatsappFormatComponent),
            },
            {
                path: 'palette-generator',
                loadComponent: () => import('./features/tools/palette-generator/palette-generator.component').then(m => m.PaletteGeneratorComponent),
            },
            {
                path: 'sitemap',
                loadComponent: () => import('./features/tools/sitemap-gen/sitemap-gen.component').then(m => m.SitemapGenComponent),
            },
            {
                path: 'qr-barcode',
                loadComponent: () => import('./features/tools/qr-barcode/qr-barcode.component').then(m => m.QrBarcodeComponent),
            },
            {
                path: 'password-gen',
                loadComponent: () => import('./features/tools/password-gen/password-gen.component').then(m => m.PasswordGenComponent),
            },
            {
                path: 'url-codec',
                loadComponent: () => import('./features/tools/url-codec/url-codec.component').then(m => m.UrlCodecComponent),
            },
            {
                path: 'jwt-codec',
                loadComponent: () => import('./features/tools/jwt-codec/jwt-codec.component').then(m => m.JwtCodecComponent),
            },
            // --- New utility tools -----------------------------------------------
            {
                path: 'json',
                loadComponent: () => import('./features/tools/json-toolkit/json-toolkit.component').then(m => m.JsonToolkitComponent),
            },
            {
                path: 'diff',
                loadComponent: () => import('./features/tools/diff-checker/diff-checker.component').then(m => m.DiffCheckerComponent),
            },
            {
                path: 'regex',
                loadComponent: () => import('./features/tools/regex-tester/regex-tester.component').then(m => m.RegexTesterComponent),
            },
            {
                path: 'timestamp',
                loadComponent: () => import('./features/tools/timestamp/timestamp.component').then(m => m.TimestampComponent),
            },
            {
                path: 'uuid',
                loadComponent: () => import('./features/tools/uuid-gen/uuid-gen.component').then(m => m.UuidGenComponent),
            },
            {
                path: 'text-utils',
                loadComponent: () => import('./features/tools/text-utils/text-utils.component').then(m => m.TextUtilsComponent),
            },
            // --- Redirects for tools merged into the ones above ------------------
            { path: 'seo-tools', redirectTo: '/seo' },
            { path: 'rem-px', redirectTo: 'css-units', pathMatch: 'full' },
            { path: 'scss-nesting', redirectTo: 'css-scss', pathMatch: 'full' },
            { path: 'image-compress', redirectTo: 'image-format', pathMatch: 'full' },
            { path: 'image-webp', redirectTo: 'image-format', pathMatch: 'full' },
            { path: 'image-palette', redirectTo: 'palette-generator', pathMatch: 'full' },
            { path: 'code-image', redirectTo: 'text-image', pathMatch: 'full' },
            { path: 'design-extractor', redirectTo: '/seo', pathMatch: 'full' },
            { path: 'robots-txt', redirectTo: 'sitemap', pathMatch: 'full' },
            { path: 'base64-codec', redirectTo: 'url-codec', pathMatch: 'full' },
            { path: '**', redirectTo: '' },
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
                path: 'services',
                loadComponent: () => import('./features/main/services/services.component').then(m => m.ServicesComponent),
            },
            {
                path: 'about',
                loadComponent: () => import('./features/main/about/about.component').then(m => m.AboutComponent),
            },
            {
                path: 'faq',
                loadComponent: () => import('./features/main/faq/faq.component').then(m => m.FaqComponent),
            },
            {
                path: 'credits',
                loadComponent: () => import('./features/main/credits/credits.component').then(m => m.CreditsComponent),
            },
            {
                path: 'brand',
                loadComponent: () => import('./features/main/brand/brand.component').then(m => m.BrandComponent),
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
                path: 'games',
                loadComponent: () => import('./features/games/games.component').then(m => m.GamesComponent),
            },
            {
                path: 'games/snake',
                loadComponent: () => import('./features/games/snake/snake.component').then(m => m.SnakeComponent),
            },
            {
                path: 'games/ping-pong',
                loadComponent: () => import('./features/games/ping-pong/ping-pong.component').then(m => m.PingPongComponent),
            },
            { path: 'games/pong-2p', redirectTo: 'games/ping-pong' },
            {
                path: 'games/2048',
                loadComponent: () => import('./features/games/twenty48/twenty48.component').then(m => m.Twenty48Component),
            },
            {
                path: 'games/memory',
                loadComponent: () => import('./features/games/memory/memory.component').then(m => m.MemoryComponent),
            },
            {
                path: 'games/minesweeper',
                loadComponent: () => import('./features/games/minesweeper/minesweeper.component').then(m => m.MinesweeperComponent),
            },
            {
                path: 'games/breakout',
                loadComponent: () => import('./features/games/breakout/breakout.component').then(m => m.BreakoutComponent),
            },
            {
                path: 'games/space-invaders',
                loadComponent: () => import('./features/games/space-invaders/space-invaders.component').then(m => m.SpaceInvadersComponent),
            },
            {
                path: 'games/tetris',
                loadComponent: () => import('./features/games/tetris/tetris.component').then(m => m.TetrisComponent),
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
