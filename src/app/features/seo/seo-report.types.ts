/**
 * Shared response contract for the standalone /seo audit tool. The frontend
 * (features/seo/) mirrors these types exactly — keep both in sync.
 */

export type IssueLevel = 'good' | 'warn' | 'error';

export interface Issue {
    level: IssueLevel;
    msg: string;
}

// --- 1. Technical SEO --------------------------------------------------------
export interface SslInfo {
    valid: boolean;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    daysRemaining?: number;
    error?: string;
}

export interface RedirectHop {
    url: string;
    status: number;
}

export interface TechnicalSeo {
    httpStatus: number;
    redirectChain: RedirectHop[];
    https: boolean;
    ssl: SslInfo | null;
    canonical: string | null;
    canonicalMatchesUrl: boolean;
    robotsMeta: string | null;
    robotsTxt: { exists: boolean; url: string; disallowsPath: boolean };
    sitemapXml: { exists: boolean; url: string | null };
    indexable: boolean;
    noindex: boolean;
    nofollow: boolean;
    hreflang: { lang: string; href: string }[];
    pagination: { prev: string | null; next: string | null };
    amp: { isAmp: boolean; ampUrl: string | null };
    structuredDataPresent: boolean;
    responseTimeMs: number;
    ttfbMs: number;
    dnsMs: number | null;
    contentEncoding: string | null;
    cacheControl: string | null;
    etag: string | null;
    server: string | null;
    mixedContent: string[];
    brokenResources: { url: string; status: number | null; error?: string }[];
    issues: Issue[];
}

// --- 2. HTML audit ------------------------------------------------------------
export interface HtmlAudit {
    title: string | null;
    description: string | null;
    viewport: string | null;
    charset: string | null;
    canonical: string | null;
    metaRobots: string | null;
    author: string | null;
    generator: string | null;
    lang: string | null;
    favicon: string | null;
    titleLength: number;
    descriptionLength: number;
    titlePixelWidth: number;
    descriptionPixelWidth: number;
    duplicateTags: string[];
    missingTags: string[];
    issues: Issue[];
}

// --- 3. Headings --------------------------------------------------------------
export interface HeadingsAudit {
    all: { level: number; text: string }[];
    h1Count: number;
    hasExactlyOneH1: boolean;
    hasMultipleH1: boolean;
    hasMissingH1: boolean;
    skippedLevels: number[];
    hierarchyOk: boolean;
    issues: Issue[];
}

// --- 4. Images ----------------------------------------------------------------
export interface ImageDescriptor {
    src: string;
    alt: string | null;
    hasWidth: boolean;
    hasHeight: boolean;
    lazy: boolean;
    format: string;
}

export interface ImagesAudit {
    total: number;
    missingAlt: number;
    emptyAlt: number;
    duplicateAlt: { alt: string; count: number }[];
    withoutDimensions: number;
    lazyLoadedCount: number;
    webpCount: number;
    avifCount: number;
    modernFormatCount: number;
    checkedCount: number;
    large: { src: string; bytes: number }[];
    broken: { src: string; status: number | null }[];
    issues: Issue[];
}

// --- 5. Links -----------------------------------------------------------------
export interface LinkDescriptor {
    href: string;
    text: string;
    isInternal: boolean;
    rel: string[];
}

export interface LinksAudit {
    internalCount: number;
    externalCount: number;
    nofollowCount: number;
    sponsoredCount: number;
    ugcCount: number;
    emptyAnchorCount: number;
    genericAnchorCount: number;
    checkedCount: number;
    broken: { href: string; status: number | null; error?: string }[];
    redirects: { href: string; status: number }[];
    issues: Issue[];
}

// --- 6. Performance (static proxies — no headless browser) --------------------
export interface PerformanceAudit {
    pageWeightBytes: number;
    responseTimeMs: number;
    ttfbMs: number;
    renderBlockingScripts: number;
    renderBlockingStyles: number;
    totalScripts: number;
    totalStylesheets: number;
    fontLinks: number;
    compressed: boolean;
    note: string;
    issues: Issue[];
}

// --- 7. Accessibility (static only) -------------------------------------------
export interface AccessibilityAudit {
    imagesMissingAlt: number;
    inputsMissingLabel: number;
    buttonsMissingText: number;
    landmarks: { header: boolean; nav: boolean; main: boolean; footer: boolean };
    langPresent: boolean;
    note: string;
    issues: Issue[];
}

// --- 8. Structured data --------------------------------------------------------
export interface JsonLdEntry {
    type: string;
    valid: boolean;
    error?: string;
}

export interface StructuredDataAudit {
    jsonLd: JsonLdEntry[];
    microdataItemCount: number;
    typesFound: string[];
    issues: Issue[];
}

// --- 9. Social ------------------------------------------------------------------
export interface SocialAudit {
    og: Record<string, string>;
    twitter: Record<string, string>;
    previewTitle: string | null;
    previewDescription: string | null;
    previewImage: string | null;
    previewDomain: string;
    issues: Issue[];
}

// --- 10. Content analysis -------------------------------------------------------
export interface KeywordStat {
    word: string;
    count: number;
    density: number;
}

export interface PhraseStat {
    phrase: string;
    count: number;
}

export interface ContentAudit {
    wordCount: number;
    readingTimeMinutes: number;
    fleschReadingEase: number;
    fleschKincaidGrade: number;
    avgSentenceLength: number;
    longSentenceCount: number;
    passiveVoiceCount: number;
    topKeywords: KeywordStat[];
    bigrams: PhraseStat[];
    trigrams: PhraseStat[];
    duplicateParagraphs: number;
    listCount: number;
    tableCount: number;
    videoCount: number;
    issues: Issue[];
}

// --- 11. Security -----------------------------------------------------------------
export interface CookieInfo {
    name: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: string | null;
}

export interface SecurityAudit {
    https: boolean;
    hsts: string | null;
    csp: string | null;
    xFrameOptions: string | null;
    xXssProtection: string | null;
    referrerPolicy: string | null;
    permissionsPolicy: string | null;
    cookies: CookieInfo[];
    issues: Issue[];
}

// --- 12. Mobile -------------------------------------------------------------------
export interface MobileAudit {
    viewportPresent: boolean;
    viewportContent: string | null;
    responsiveHeuristic: boolean;
    mediaQueryCount: number;
    smallBaseFont: boolean;
    note: string;
    issues: Issue[];
}

// --- 13. Fonts & design -------------------------------------------------------------
export interface DesignAudit {
    colors: string[];
    fonts: string[];
    googleFonts: string[];
    selfHostedFonts: string[];
    cssVariables: string[];
    borderRadiusValues: string[];
    spacingValues: string[];
    iconLibraries: string[];
    darkModeSupport: boolean;
    animationCount: number;
    issues: Issue[];
}

// --- 14. Technologies ----------------------------------------------------------------
export interface TechnologiesAudit {
    frameworks: string[];
    cssFrameworks: string[];
    cms: string[];
    analytics: string[];
    infra: string[];
    all: string[];
}

// --- 15. Recommendations (deterministic rules engine, not a live LLM call) -----------
export type SeoImpact = 'high' | 'medium' | 'low';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Recommendation {
    id: string;
    title: string;
    category: string;
    level: IssueLevel;
    explanation: string;
    whyItMatters: string;
    seoImpact: SeoImpact;
    difficulty: Difficulty;
    estimatedFixTime: string;
    priority: number;
    codeBefore?: string;
    codeAfter?: string;
}

// --- 16. Scores ------------------------------------------------------------------------
export interface Scores {
    seo: number;
    performance: number;
    accessibility: number;
    security: number;
    bestPractices: number;
    design: number;
    content: number;
    mobile: number;
    overall: number;
}

// --- Top-level report --------------------------------------------------------------------
export interface SeoAuditReport {
    url: string;
    finalUrl: string;
    fetchedAt: string;
    durationMs: number;

    technical: TechnicalSeo;
    html: HtmlAudit;
    headings: HeadingsAudit;
    images: ImagesAudit;
    links: LinksAudit;
    performance: PerformanceAudit;
    accessibility: AccessibilityAudit;
    structuredData: StructuredDataAudit;
    social: SocialAudit;
    content: ContentAudit;
    security: SecurityAudit;
    mobile: MobileAudit;
    design: DesignAudit;
    technologies: TechnologiesAudit;
    recommendations: Recommendation[];
    scores: Scores;
}
