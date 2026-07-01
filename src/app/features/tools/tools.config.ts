/**
 * Central registry of public dev-tools surfaced at /tools.
 *
 * `status: 'live'` tools have a dedicated route + component; `status: 'soon'`
 * are shown as disabled placeholders. `premium` is kept only as a label/chip —
 * all tools are currently free and fully usable.
 */
export interface ToolMeta {
    id: string;
    slug: string;
    name: string;
    desc: string;
    icon: string;
    category: string;
    status: 'live' | 'soon';
    premium: boolean;
}

export const TOOLS: ToolMeta[] = [
    // --- CSS -----------------------------------------------------------------
    {
        id: 'rem-px',
        slug: 'rem-px',
        name: 'REM ↔ PX',
        desc: 'Convert between rem and px against any root font-size, instantly.',
        icon: 'bi-arrows-collapse',
        category: 'CSS',
        status: 'live',
        premium: false,
    },
    {
        id: 'unit-converter',
        slug: 'css-units',
        name: 'CSS Unit Converter',
        desc: 'Convert px, rem, em, pt, %, vw and vh with full context.',
        icon: 'bi-rulers',
        category: 'CSS',
        status: 'live',
        premium: false,
    },
    {
        id: 'css-scss',
        slug: 'css-scss',
        name: 'CSS ↔ SCSS',
        desc: 'Convert between plain CSS and SCSS in either direction.',
        icon: 'bi-filetype-scss',
        category: 'CSS',
        status: 'live',
        premium: false,
    },
    {
        id: 'scss-nesting',
        slug: 'scss-nesting',
        name: 'SCSS Nesting',
        desc: 'Auto-nest flat CSS selectors into clean SCSS blocks.',
        icon: 'bi-diagram-3',
        category: 'CSS',
        status: 'live',
        premium: false,
    },

    // --- Code ----------------------------------------------------------------
    {
        id: 'minify',
        slug: 'minify',
        name: 'HTML / CSS / JS Minifier',
        desc: 'Shrink HTML, CSS and JavaScript and see the bytes you saved.',
        icon: 'bi-file-zip',
        category: 'Code',
        status: 'live',
        premium: false,
    },
    {
        id: 'code-image',
        slug: 'code-image',
        name: 'Code → Image',
        desc: 'Turn syntax-highlighted code into a shareable image.',
        icon: 'bi-code-square',
        category: 'Code',
        status: 'live',
        premium: false,
    },

    // --- Image ---------------------------------------------------------------
    {
        id: 'image-compress',
        slug: 'image-compress',
        name: 'Image Compression',
        desc: 'Compress images to the smallest size without visible loss.',
        icon: 'bi-file-earmark-image',
        category: 'Image',
        status: 'live',
        premium: false,
    },
    {
        id: 'image-format',
        slug: 'image-format',
        name: 'Image Format Changer',
        desc: 'Convert images between PNG, JPG, WebP, AVIF and GIF.',
        icon: 'bi-arrow-repeat',
        category: 'Image',
        status: 'live',
        premium: false,
    },
    {
        id: 'image-webp',
        slug: 'image-webp',
        name: 'Image → WebP',
        desc: 'Convert any image to a smaller, modern WebP file.',
        icon: 'bi-filetype-webp',
        category: 'Image',
        status: 'live',
        premium: false,
    },
    {
        id: 'image-upscale',
        slug: 'image-upscale',
        name: 'Image Upscale',
        desc: 'Upscale images 2–4× with high-quality resampling.',
        icon: 'bi-aspect-ratio',
        category: 'Image',
        status: 'live',
        premium: false,
    },
    {
        id: 'image-palette',
        slug: 'image-palette',
        name: 'Image Color Palette',
        desc: 'Pull the dominant colour palette out of any image.',
        icon: 'bi-palette2',
        category: 'Image',
        status: 'live',
        premium: false,
    },
    {
        id: 'favicon-ico',
        slug: 'favicon',
        name: 'Favicon (.ico) Generator',
        desc: 'Turn any image into a multi-size .ico favicon.',
        icon: 'bi-star',
        category: 'Image',
        status: 'live',
        premium: false,
    },

    // --- Color ---------------------------------------------------------------
    {
        id: 'palette-generator',
        slug: 'palette-generator',
        name: 'Palette Generator',
        desc: 'Generate harmonious colour palettes from a single seed.',
        icon: 'bi-palette',
        category: 'Color',
        status: 'live',
        premium: false,
    },
    {
        id: 'design-extractor',
        slug: 'design-extractor',
        name: 'Design System Extractor',
        desc: 'Extract colours and fonts from any live website.',
        icon: 'bi-eyedropper',
        category: 'Color',
        status: 'live',
        premium: false,
    },

    // --- Text ----------------------------------------------------------------
    {
        id: 'text-image',
        slug: 'text-image',
        name: 'Text → Image',
        desc: 'Render styled text as a downloadable image.',
        icon: 'bi-fonts',
        category: 'Text',
        status: 'live',
        premium: false,
    },
    {
        id: 'whatsapp-format',
        slug: 'whatsapp-format',
        name: 'WhatsApp Text Formatter',
        desc: 'Add bold, italic, strikethrough and monospace to WhatsApp text.',
        icon: 'bi-whatsapp',
        category: 'Text',
        status: 'live',
        premium: false,
    },

    // --- SEO -----------------------------------------------------------------
    {
        id: 'seo-tools',
        slug: 'seo-tools',
        name: 'SEO Tools',
        desc: 'Audit meta tags, headings and Open Graph for any URL.',
        icon: 'bi-search',
        category: 'SEO',
        status: 'live',
        premium: false,
    },
    {
        id: 'sitemap-gen',
        slug: 'sitemap',
        name: 'Sitemap Generator',
        desc: 'Build a valid sitemap.xml from your list of URLs.',
        icon: 'bi-diagram-2',
        category: 'SEO',
        status: 'live',
        premium: false,
    },
    {
        id: 'robots-gen',
        slug: 'robots-txt',
        name: 'robots.txt Generator',
        desc: 'Compose robots.txt rules with allow, disallow and sitemap.',
        icon: 'bi-robot',
        category: 'SEO',
        status: 'live',
        premium: false,
    },

    // --- Generate ------------------------------------------------------------
    {
        id: 'qr-barcode',
        slug: 'qr-barcode',
        name: 'QR / Barcode Generator',
        desc: 'Generate customisable QR codes and barcodes for any payload.',
        icon: 'bi-qr-code',
        category: 'Generate',
        status: 'live',
        premium: false,
    },

    // --- Security / Encode ---------------------------------------------------
    {
        id: 'password-gen',
        slug: 'password-gen',
        name: 'Password Generator',
        desc: 'Create strong passwords and hash them with bcrypt or SHA.',
        icon: 'bi-key',
        category: 'Security',
        status: 'live',
        premium: false,
    },
    {
        id: 'url-codec',
        slug: 'url-codec',
        name: 'URL Encoder / Decoder',
        desc: 'Encode and decode URL components safely.',
        icon: 'bi-link-45deg',
        category: 'Encode',
        status: 'live',
        premium: false,
    },
    {
        id: 'base64-codec',
        slug: 'base64-codec',
        name: 'Base64 Encoder / Decoder',
        desc: 'Encode text and files to Base64 and back.',
        icon: 'bi-file-binary',
        category: 'Encode',
        status: 'live',
        premium: false,
    },
    {
        id: 'jwt-codec',
        slug: 'jwt-codec',
        name: 'JWT Encoder / Decoder',
        desc: 'Inspect, decode and sign JSON Web Tokens.',
        icon: 'bi-shield-lock',
        category: 'Encode',
        status: 'live',
        premium: false,
    },
];
