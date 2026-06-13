/**
 * Canonical site content shared across the public pages.
 *
 * The home page, the dedicated /services page, and the /faq page all render
 * from these same arrays so the content (and therefore the design) can never
 * drift apart again. Keep the field shapes stable — the home template binds to
 * `services`, `processSteps`, `pricingTiers`, `faqs`, and `techStack`.
 */

export interface ServiceItem {
    /** Bootstrap-icon class, e.g. 'bi-app'. */
    icon: string;
    name: string;
    desc: string;
    tags: string[];
    /** Pre-fills the /contact form subject. */
    subject: string;
    /** Pre-fills the /contact form message. */
    message: string;
    /** Shown in the home-page teaser; the full list lives on /services. */
    featured?: boolean;
}

export interface ProcessStep {
    icon: string;
    name: string;
    desc: string;
}

export interface PricingTier {
    tier: string;
    amount: string;
    suffix: string;
    desc: string;
    features: string[];
    cta: string;
    subject: string;
    note: string;
    featured: boolean;
}

export interface FaqItem {
    q: string;
    a: string;
}

export const SERVICES: ServiceItem[] = [
    {
        icon: 'bi-layout-text-window-reverse',
        name: 'Website Design',
        desc: 'Pixel-perfect UI layouts and visual web designs tailored to your brand identity.',
        tags: ['UI/UX', 'Mockups'],
        subject: 'Website Design',
        message: "Hi, I'm interested in your Website Design service. I'd love to discuss my project and get a custom design proposal.",
        featured: true,
    },
    {
        icon: 'bi-app',
        name: 'Application Development',
        desc: 'Full-stack web applications built with modern frameworks — Angular, NestJS, React and more.',
        tags: ['Full-stack'],
        subject: 'Application Development',
        message: "Hi, I'm interested in your Application Development service. I'd like to discuss building a full-stack application for my project.",
        featured: true,
    },
    {
        icon: 'bi-lightning-charge',
        name: 'PWA & SSR',
        desc: 'Progressive Web Apps and server-side rendered experiences for lightning-fast load times and offline capability.',
        tags: ['PWA', 'SSR'],
        subject: 'PWA & SSR',
        message: "Hi, I'm interested in your PWA & SSR service. I'd like to discuss making my app a Progressive Web App with server-side rendering.",
        featured: true,
    },
    {
        icon: 'bi-phone',
        name: 'Hybrid App Development',
        desc: 'Cross-platform mobile apps built once, running natively on iOS and Android with a seamless user experience.',
        tags: ['Hybrid'],
        subject: 'Hybrid App Development',
        message: "Hi, I'm interested in your Hybrid App Development service. I'd like to build a cross-platform mobile app and would love to discuss the details.",
    },
    {
        icon: 'bi-globe',
        name: 'Website Development',
        desc: 'Fast, responsive, and SEO-optimised websites — from landing pages to full portals, with clean frontend code throughout.',
        tags: ['SEO', 'Full-stack'],
        subject: 'Website Development',
        message: "Hi, I'm interested in your Website Development service. I need a professional website and would love to discuss my requirements.",
        featured: true,
    },
    {
        icon: 'bi-pen',
        name: 'Logo & Icon Design',
        desc: 'Memorable logos, brand marks, and icon sets that communicate the essence of your identity.',
        tags: ['Branding', 'Icons'],
        subject: 'Logo & Icon Design',
        message: "Hi, I'm interested in your Logo & Icon Design service. I need a unique logo and icons for my brand.",
    },
    {
        icon: 'bi-bezier2',
        name: 'UI/UX & Prototyping',
        desc: 'High-fidelity wireframes, mockups, and interactive prototypes crafted in Adobe XD and Figma.',
        tags: ['UI/UX', 'Mockups'],
        subject: 'UI/UX & Prototyping',
        message: "Hi, I'm interested in your UI/UX & Prototyping service. I need high-fidelity wireframes and interactive prototypes.",
        featured: true,
    },
    {
        icon: 'bi-robot',
        name: 'AI Integration',
        desc: 'Integrating AI-powered features — from smart assistants to automated workflows — into your products.',
        tags: ['AI'],
        subject: 'AI Integration',
        message: "Hi, I'm interested in your AI Integration service. I'd like to discuss how AI can be applied to my project.",
        featured: true,
    },
    {
        icon: 'bi-people',
        name: 'Team Leadership',
        desc: 'Technical leadership, mentoring, and team management to help your development squad deliver with confidence.',
        tags: [],
        subject: 'Team Leadership',
        message: "Hi, I'm interested in your Team Leadership service. I'd like to discuss how you can help lead or mentor my development team.",
    },
    {
        icon: 'bi-bug',
        name: 'Programming Troubleshooting',
        desc: 'Diagnosing and fixing bugs, performance issues, and broken builds across any stack.',
        tags: [],
        subject: 'Programming Troubleshooting',
        message: "Hi, I'm facing some technical issues and need help with debugging. I'd like to discuss the problem and find a solution together.",
    },
    {
        icon: 'bi-pencil-square',
        name: 'Blogging',
        desc: 'Technical articles, tutorials, and thought-leadership content crafted to educate and engage your audience.',
        tags: [],
        subject: 'Blogging',
        message: "Hi, I'm interested in your Blogging service. I'd like to discuss content creation and technical writing for my platform.",
    },
];

export const PROCESS_STEPS: ProcessStep[] = [
    {
        icon: 'bi-chat-text',
        name: 'Discover',
        desc: 'We define your goals, audience, and constraints together — I listen before I build.',
    },
    {
        icon: 'bi-bezier2',
        name: 'Design',
        desc: 'Wireframes and prototypes shaped around real user needs — validated before a line of code is written.',
    },
    {
        icon: 'bi-code-slash',
        name: 'Build',
        desc: 'Clean, tested code delivered in iterative sprints with full visibility into progress.',
    },
    {
        icon: 'bi-rocket-takeoff',
        name: 'Deliver',
        desc: "Deployed, documented, and supported after go-live — the relationship doesn't end at launch.",
    },
];

export const PRICING_TIERS: PricingTier[] = [
    {
        tier: 'Starter',
        amount: '$200',
        suffix: '/ project',
        desc: 'Landing pages, UI/UX designs, and simple static websites.',
        features: [
            'Responsive design (mobile-first)',
            'Figma / Adobe XD prototype',
            'Up to 5 pages',
            '2 revision rounds',
            'Delivered in 1–2 weeks',
        ],
        cta: 'Get started',
        subject: 'Starter Package Inquiry',
        note: 'Starting estimate — final price depends on scope',
        featured: false,
    },
    {
        tier: 'Professional',
        amount: '$800',
        suffix: '/ project',
        desc: 'Full-stack web apps, portals, dashboards, and e-commerce platforms.',
        features: [
            'Custom frontend + backend',
            'Database design & REST API',
            'Auth, roles & permissions',
            'Deployment & CI/CD support',
            'Delivered in 3–6 weeks',
        ],
        cta: "Let's build it",
        subject: 'Professional Package Inquiry',
        note: 'Starting estimate — final price depends on scope',
        featured: true,
    },
    {
        tier: 'Enterprise',
        amount: 'Custom',
        suffix: '',
        desc: 'Architecture consulting, team leadership, and long-term engagements.',
        features: [
            'Technical discovery & planning',
            'System architecture design',
            'Code review & team mentoring',
            'Ongoing maintenance & support',
            'Timeline negotiated upfront',
        ],
        cta: 'Get in touch',
        subject: 'Enterprise Package Inquiry',
        note: 'Scope and pricing defined after discovery call',
        featured: false,
    },
];

export const FAQS: FaqItem[] = [
    {
        q: 'Do you work with international clients?',
        a: 'Absolutely. I work with clients globally across the US, UK, Europe, and beyond. Communication is handled over email, Slack, or video calls at mutually convenient times.',
    },
    {
        q: 'How long does a typical project take?',
        a: "It depends on scope. A landing page can be ready in 1–2 weeks; a full-stack web application typically takes 3–8 weeks. I'll give you a clear timeline estimate before we start.",
    },
    {
        q: 'Do you sign NDAs?',
        a: "Yes, I'm happy to sign a Non-Disclosure Agreement before discussing project details. Your IP and business data are safe.",
    },
    {
        q: 'What is your revision policy?',
        a: 'Every project includes 2 rounds of revisions as standard. Additional revisions are billed at an hourly rate agreed on upfront.',
    },
    {
        q: 'What payment methods do you accept?',
        a: "I accept bank transfer, PayPal, Wise, and other common international payment methods. We'll agree on milestones and a payment schedule before starting.",
    },
    {
        q: 'Can you join an existing team or project?',
        a: "Yes. I'm comfortable stepping into ongoing projects, reviewing existing codebases, and collaborating with other developers, designers, and stakeholders.",
    },
];

export const TECH_STACK: string[] = [
    'Angular', 'TypeScript', 'RxJS', 'NgRx',
    'NestJS', 'Node.js', 'PostgreSQL', 'TypeORM',
    'Socket.io', 'Firebase', 'REST API', 'GraphQL',
    'Ionic', 'Capacitor', 'React', 'HTML / CSS',
    'SCSS / SASS', 'Bootstrap', 'Figma', 'Adobe XD',
    'Git', 'Docker', 'Linux', 'PWA / SSR',
];
