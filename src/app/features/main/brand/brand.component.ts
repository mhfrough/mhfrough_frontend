import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';

interface Swatch {
    name: string;
    value: string;
    role: string;
    /** 'light' = dark text reads on it, 'dark' = light text reads on it. */
    ink?: 'light' | 'dark';
}

interface ColorGroup {
    title: string;
    note: string;
    swatches: Swatch[];
}

interface TypeSpecimen {
    label: string;
    cls: string;
    meta: string;
    sample: string;
}

interface SpaceStep {
    token: string;
    px: number;
}

interface MotionToken {
    token: string;
    value: string;
    use: string;
}

interface Principle {
    icon: string;
    title: string;
    body: string;
}

interface TocItem {
    id: string;
    label: string;
    num: string;
}

@Component({
    selector: 'app-brand',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './brand.component.html',
    styleUrl: './brand.component.scss',
})
export class BrandComponent implements OnInit {
    private readonly seo = inject(SeoService);

    // --- In-page table of contents -------------------------------------------
    readonly toc: TocItem[] = [
        { num: '01', id: 'logo', label: 'Logo & Mark' },
        { num: '02', id: 'principles', label: 'Principles' },
        { num: '03', id: 'color', label: 'Color' },
        { num: '04', id: 'type', label: 'Typography' },
        { num: '05', id: 'spacing', label: 'Spacing' },
        { num: '06', id: 'radius', label: 'Radius & Borders' },
        { num: '07', id: 'elevation', label: 'Elevation' },
        { num: '08', id: 'motion', label: 'Motion' },
        { num: '09', id: 'components', label: 'Components' },
        { num: '10', id: 'icons', label: 'Iconography' },
        { num: '11', id: 'layout', label: 'Layout & Grid' },
        { num: '12', id: 'a11y', label: 'Accessibility' },
    ];

    // --- Brand principles ----------------------------------------------------
    readonly principles: Principle[] = [
        { icon: 'bi-grid-1x2', title: 'Consistency', body: 'One typeface, one spacing rhythm, one set of tokens. The same control behaves the same way on every screen.' },
        { icon: 'bi-dash-square', title: 'Restraint', body: 'Pointy edges, hairline borders, generous whitespace. Every element earns its place — nothing decorative.' },
        { icon: 'bi-universal-access', title: 'Accessible', body: 'AA contrast, visible focus, 44px touch targets and reduced-motion support are non-negotiable.' },
        { icon: 'bi-arrow-repeat', title: 'Predictable', body: 'Buttons, links, forms and navigation respond the same way every time. No surprises.' },
        { icon: 'bi-bounding-box', title: 'Tokenised', body: 'Every visual property resolves from a CSS custom property. Re-theme the whole site from one block.' },
        { icon: 'bi-recycle', title: 'Reusable', body: 'Components are variant- and state-driven so new pages compose from parts that already exist.' },
    ];

    // --- Color system --------------------------------------------------------
    readonly colorGroups: ColorGroup[] = [
        {
            title: 'Surfaces',
            note: 'Warm charcoal stack — raised fills tint lighter, not bluer.',
            swatches: [
                { name: '--bg', value: '#1a1917', role: 'Page background', ink: 'dark' },
                { name: '--bg-alt', value: '#242220', role: 'Cards · hover · panels', ink: 'dark' },
                { name: '--bg-footer', value: '#1f1d1b', role: 'Footer · wells', ink: 'dark' },
                { name: '--surface', value: '#242220', role: 'Inputs · raised surface', ink: 'dark' },
            ],
        },
        {
            title: 'Ink & Lines',
            note: 'Bone-white text on charcoal; borders are text at 10% alpha.',
            swatches: [
                { name: '--text', value: '#e4e0d8', role: 'Primary text', ink: 'light' },
                { name: '--text-muted', value: '#928e87', role: 'Secondary · labels', ink: 'light' },
                { name: '--border', value: 'rgba(228,224,216,.10)', role: 'Hairline dividers', ink: 'dark' },
            ],
        },
        {
            title: 'Accent & Semantic',
            note: 'Indigo is the single brand accent — the dot in the wordmark.',
            swatches: [
                { name: '--primary', value: '#6366f1', role: 'Accent · the dot', ink: 'dark' },
                { name: '--success', value: '#4ade80', role: 'Success · online', ink: 'light' },
                { name: '--warn', value: '#d97706', role: 'Warning', ink: 'dark' },
                { name: '--danger', value: '#dc2626', role: 'Danger · destructive', ink: 'dark' },
            ],
        },
    ];

    // --- Typography ----------------------------------------------------------
    readonly typeScale: TypeSpecimen[] = [
        { label: 'Hero', cls: 'sp-hero', meta: 'clamp 2.8–4.5rem · 700 · −0.03em', sample: 'Build it once.' },
        { label: 'Page title', cls: 'sp-title', meta: 'clamp 2–3rem · 700 · −0.02em', sample: 'Design System' },
        { label: 'Heading', cls: 'sp-h2', meta: '1.6rem · 600', sample: 'Section heading' },
        { label: 'Body large', cls: 'sp-body-lg', meta: '1rem · 1.8 line-height', sample: 'The quick brown fox jumps over the lazy dog.' },
        { label: 'Body', cls: 'sp-body', meta: '0.88rem · 1.75 line-height', sample: 'The quick brown fox jumps over the lazy dog.' },
        { label: 'Section label', cls: 'sp-label', meta: '0.68rem · 500 · 0.16em · uppercase', sample: 'Foundations' },
        { label: 'Caption', cls: 'sp-caption', meta: '0.72rem · muted', sample: 'Self-hosted via Fontsource' },
    ];

    // --- Spacing (8px base scale) --------------------------------------------
    readonly spacing: SpaceStep[] = [
        { token: 'space-0', px: 0 },
        { token: 'space-2', px: 2 },
        { token: 'space-4', px: 4 },
        { token: 'space-8', px: 8 },
        { token: 'space-12', px: 12 },
        { token: 'space-16', px: 16 },
        { token: 'space-24', px: 24 },
        { token: 'space-32', px: 32 },
        { token: 'space-48', px: 48 },
        { token: 'space-64', px: 64 },
        { token: 'space-96', px: 96 },
        { token: 'space-128', px: 128 },
    ];

    // --- Motion --------------------------------------------------------------
    readonly motion: MotionToken[] = [
        { token: '--dur-fast', value: '120ms', use: 'Hover · color shifts' },
        { token: '--dur', value: '220ms', use: 'Default transition' },
        { token: 'reveal', value: '550ms', use: 'Scroll-in reveal' },
    ];

    readonly ease = 'cubic-bezier(0.4, 0, 0.2, 1)';

    // --- Iconography sample --------------------------------------------------
    readonly icons = [
        'bi-person', 'bi-briefcase', 'bi-images', 'bi-stars', 'bi-pencil-square',
        'bi-star', 'bi-chat-dots', 'bi-envelope-paper', 'bi-grid-3x3-gap',
        'bi-arrow-right', 'bi-github', 'bi-linkedin',
    ];

    // --- Breakpoints ---------------------------------------------------------
    readonly breakpoints = [
        { label: 'Mobile', range: '0 – 479', cols: '4 col' },
        { label: 'Phablet', range: '480 – 639', cols: '4 col' },
        { label: 'Tablet', range: '640 – 767', cols: '8 col' },
        { label: 'Laptop', range: '768 – 899', cols: '8 col' },
        { label: 'Desktop', range: '900 – 1139', cols: '12 col' },
        { label: 'Wide', range: '1140+', cols: 'container' },
    ];

    ngOnInit(): void {
        this.seo.update({
            title: 'Brand & Design System | Mohammad Hamza',
            description:
                'The brand identity and design system behind mhfrough.dev — logo, color, typography, spacing, motion and components, all driven by shared tokens.',
            url: '/brand',
        });
    }
}
