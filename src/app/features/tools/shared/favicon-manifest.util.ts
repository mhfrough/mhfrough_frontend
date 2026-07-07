export interface ManifestOptions {
    siteName: string;
    themeColor: string;
    backgroundColor: string;
}

export function buildWebManifest(opts: ManifestOptions): string {
    return JSON.stringify(
        {
            name: opts.siteName || 'My Site',
            short_name: opts.siteName || 'My Site',
            icons: [
                { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
                { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
            ],
            theme_color: opts.themeColor,
            background_color: opts.backgroundColor,
            display: 'standalone',
        },
        null,
        4,
    );
}

/** manifest.json is a duplicate of site.webmanifest for tooling that expects that exact filename. */
export function buildManifestJson(opts: ManifestOptions): string {
    return buildWebManifest(opts);
}

export function buildBrowserConfigXml(tileColor: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
    <msapplication>
        <tile>
            <square150x150logo src="/mstile-150x150.png"/>
            <TileColor>${tileColor}</TileColor>
        </tile>
    </msapplication>
</browserconfig>
`;
}

export interface HtmlSnippetOptions {
    themeColor: string;
    hasDarkVariant: boolean;
}

export function buildHtmlSnippet(opts: HtmlSnippetOptions): string {
    const lines = [
        '<link rel="icon" type="image/x-icon" href="/favicon.ico">',
        '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
        '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
        '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
        '<link rel="manifest" href="/site.webmanifest">',
        `<meta name="theme-color" content="${opts.themeColor}">`,
        `<meta name="msapplication-TileColor" content="${opts.themeColor}">`,
        '<meta name="msapplication-config" content="/browserconfig.xml">',
    ];
    if (opts.hasDarkVariant) {
        lines.push(
            '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" media="(prefers-color-scheme: light)">',
            '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32-dark.png" media="(prefers-color-scheme: dark)">',
        );
    }
    return lines.join('\n');
}

export function buildReadme(hasDarkVariant: boolean, batch: boolean): string {
    const base = `Favicon package
===============

favicon.ico             -> site root (/favicon.ico)
favicon-*.png            -> site root, referenced by the <link> tags below
apple-touch-icon.png     -> site root, used by iOS/iPadOS home screen
android-chrome-*.png     -> site root, referenced by site.webmanifest
mstile-150x150.png       -> site root, referenced by browserconfig.xml
site.webmanifest         -> site root (/site.webmanifest)
manifest.json            -> site root, duplicate of site.webmanifest for tools that expect this filename
browserconfig.xml        -> site root (/browserconfig.xml)
html-snippet.html        -> paste the contents into your <head>
`;
    const dark = hasDarkVariant
        ? '\nA dark-mode variant is included (…-dark.png) and wired up via prefers-color-scheme in html-snippet.html.\n'
        : '';
    const batchNote = batch
        ? '\nThis archive contains one subfolder per uploaded image, each a complete favicon package.\n'
        : '';
    return base + dark + batchNote;
}
