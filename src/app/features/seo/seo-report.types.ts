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

/** Static shape-of-the-URL checks (length, depth, casing, separators). */
export interface UrlStructureInfo {
    length: number;
    pathDepth: number;
    hasUppercase: boolean;
    hasUnderscores: boolean;
    queryParamCount: number;
    isClean: boolean;
}

/** Probe of a guaranteed-nonexistent path — detects soft-404 setups. */
export interface Custom404Info {
    status: number | null;
    soft404: boolean;
}

export interface TechnicalSeo {
    httpStatus: number;
    redirectChain: RedirectHop[];
    https: boolean;
    /** true = plain-HTTP request redirects to HTTPS; null = not tested (page isn't HTTPS). */
    httpRedirectsToHttps: boolean | null;
    urlStructure: UrlStructureInfo;
    custom404: Custom404Info | null;
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
    hasDoctype: boolean;
    deprecatedTags: { tag: string; count: number }[];
    metaRefresh: string | null;
    inlineStyleCount: number;
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
    /** Visible text bytes ÷ total HTML bytes (0–1). Search guidance: aim above ~0.1. */
    textHtmlRatio: number;
    /** Plain-text email addresses found in the markup (spam-harvester bait). */
    exposedEmails: string[];
    issues: Issue[];
}

// --- 10b. Target-keyword analysis (only when the user supplies a keyword) -------
export interface KeywordAudit {
    keyword: string;
    inTitle: boolean;
    inDescription: boolean;
    inH1: boolean;
    inHeadings: number;
    inFirstParagraph: boolean;
    inUrl: boolean;
    inImageAlts: number;
    inAnchorTexts: number;
    occurrences: number;
    density: number;
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
    /** Server-side languages/runtimes inferred from headers, cookies and URLs. */
    languages: string[];
    /** Client-side JS libraries (jQuery, Alpine, GSAP, …). */
    jsLibraries: string[];
    /** Detection caveats, e.g. TypeScript compiling away in shipped bundles. */
    note: string;
    all: string[];
}

// --- 14b. Hosting & infrastructure ------------------------------------------------------
export interface HostingAudit {
    /** Best-guess hosting provider/platform (Vercel, AWS, Render, …). */
    provider: string | null;
    cdn: string | null;
    dnsProvider: string | null;
    reverseDns: string | null;
    serverSoftware: string | null;
    poweredBy: string | null;
    ipCountry: string | null;
    ipCity: string | null;
    issues: Issue[];
}

// --- 14c. Marketing & analytics ----------------------------------------------------------
export interface SocialMetaCompleteness {
    present: string[];
    missing: string[];
    /** 0–100: share of the 9 recommended og:/twitter: tags present. */
    score: number;
}

export interface MarketingAudit {
    /** Analytics / pixel / chat / email tags detected on the page. */
    tags: string[];
    socialMeta: SocialMetaCompleteness;
    hasNewsletterForm: boolean;
    hasRssFeed: boolean;
    /** mailto:, tel:, WhatsApp and contact-page links found. */
    contactChannels: string[];
    issues: Issue[];
}

// --- 15b. Domain & network -----------------------------------------------------------
export interface DnsRecords {
    a: string[];
    aaaa: string[];
    mx: { priority: number; exchange: string }[];
    txt: string[];
    ns: string[];
    cname: string[];
}

export interface BlacklistResult {
    zone: string;
    listed: boolean;
}

export interface WhoisInfo {
    registrar: string | null;
    createdDate: string | null;
    expiryDate: string | null;
    daysRemaining: number | null;
    nameServers: string[];
    error?: string;
}

export interface NetworkAudit {
    ip: string | null;
    dns: DnsRecords;
    spfPresent: boolean;
    dmarcPresent: boolean;
    blacklist: BlacklistResult[];
    blacklistedCount: number;
    whois: WhoisInfo | null;
    issues: Issue[];
}

// --- 15c. Build & deploy hygiene -------------------------------------------------------
export interface ExposedFile {
    path: string;
    exposed: boolean;
}

export interface BuildHygieneAudit {
    sourceMapsExposed: string[];
    exposedFiles: ExposedFile[];
    debugIndicators: string[];
    issues: Issue[];
}

// --- 15d. PWA readiness (static detection only) -----------------------------------------
export interface PwaAudit {
    manifestUrl: string | null;
    manifestFound: boolean;
    manifestFields: {
        name: boolean;
        icons: boolean;
        startUrl: boolean;
        display: boolean;
        themeColor: boolean;
    };
    themeColorMeta: string | null;
    appleTouchIcon: boolean;
    serviceWorkerScriptDetected: boolean;
    note: string;
    issues: Issue[];
}

// --- 15e. Rendering (SSR / hydration heuristic) ------------------------------------------
export type RenderMode = 'ssr' | 'csr-shell' | 'static' | 'unknown';

export interface RenderingAudit {
    renderMode: RenderMode;
    ssrFramework: string | null;
    initialContentChars: number;
    note: string;
    issues: Issue[];
}

// --- 15f. Library vulnerabilities --------------------------------------------------------
export interface DetectedLibrary {
    name: string;
    version: string | null;
    source: string;
}

export interface LibraryVulnerability {
    name: string;
    version: string;
    severity: IssueLevel;
    advisory: string;
}

export interface LibrariesAudit {
    detected: DetectedLibrary[];
    vulnerabilities: LibraryVulnerability[];
    issues: Issue[];
}

// --- 15g. Error-page quality (extends the soft-404 probe) --------------------------------
export interface ErrorPageAudit {
    probeStatus: number | null;
    soft404: boolean;
    /** Looks like a designed page (title + copy + nav), not a bare server default. */
    hasCustomPage: boolean;
    hasTitle: boolean;
    mentionsNotFound: boolean;
    hasNavLink: boolean;
    contentLength: number;
    issues: Issue[];
}

// --- 15h. Responsive rendering (real Chromium via Playwright) ----------------------------
export interface ViewportCheck {
    name: string;
    width: number;
    height: number;
    documentWidth: number;
    hasHorizontalScroll: boolean;
    /** Small JPEG thumbnail as a data URL; null when screenshots are disabled/failed. */
    screenshot: string | null;
}

export interface ResponsiveAudit {
    /** false = headless browser unavailable in this deployment. */
    available: boolean;
    viewports: ViewportCheck[];
    consoleErrors: string[];
    failedRequests: string[];
    note: string;
    issues: Issue[];
}

// --- 15i. Cross-browser compatibility (Chromium live + static CSS heuristics) ------------
export interface CompatFeature {
    feature: string;
    count: number;
    risk: string;
}

export interface BrowserCompatAudit {
    /** Page loaded and rendered in headless Chromium; null = not tested. */
    chromiumOk: boolean | null;
    modernCssFeatures: CompatFeature[];
    /** -webkit-/-moz- prefixed properties used without an unprefixed fallback. */
    prefixOnlyProperties: string[];
    note: string;
    issues: Issue[];
}

// --- 15j. Social & brand presence ---------------------------------------------------------
export interface SocialProfileLink {
    platform: string;
    url: string;
}

export type AvailabilityStatus = 'taken' | 'available' | 'unknown';

export interface UsernameCheck {
    platform: string;
    url: string;
    status: AvailabilityStatus;
}

export interface DomainAltCheck {
    domain: string;
    status: 'registered' | 'available' | 'unknown';
}

export interface SocialPresenceAudit {
    /** Handle derived from the domain name, used for availability probes. */
    handle: string;
    found: SocialProfileLink[];
    /** Recommended platforms with no link found on the page. */
    missing: string[];
    usernameChecks: UsernameCheck[];
    domainAlternatives: DomainAltCheck[];
    issues: Issue[];
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
    /** Present only when the request included a target keyword. */
    keyword: KeywordAudit | null;
    security: SecurityAudit;
    mobile: MobileAudit;
    design: DesignAudit;
    technologies: TechnologiesAudit;
    network: NetworkAudit;
    buildHygiene: BuildHygieneAudit;
    pwa: PwaAudit;
    rendering: RenderingAudit;
    libraries: LibrariesAudit;
    errorPage: ErrorPageAudit;
    responsive: ResponsiveAudit;
    browserCompat: BrowserCompatAudit;
    socialPresence: SocialPresenceAudit;
    hosting: HostingAudit;
    marketing: MarketingAudit;
    recommendations: Recommendation[];
    scores: Scores;
}
