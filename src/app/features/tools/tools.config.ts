/**
 * Central registry of public dev-tools surfaced at /tools.
 *
 * Each entry is a merged, multi-mode tool rather than a single narrow action —
 * e.g. "Image Format & Compression" absorbs what used to be three separate
 * near-duplicate tools (compress / convert / webp) behind one format select.
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
    // --- CSS -------------------------------------------------------------------
    {
        id: 'unit-converter',
        slug: 'css-units',
        name: 'CSS Unit Converter',
        desc: 'Convert px, rem, em, pt, %, vw, vh, ch, vmin and vmax with a live rem ↔ px quick panel.',
        icon: 'bi-rulers',
        category: 'CSS',
        status: 'live',
        premium: false,
    },
    {
        id: 'css-scss',
        slug: 'css-scss',
        name: 'CSS ↔ SCSS Toolkit',
        desc: 'Convert between CSS and SCSS, or auto-nest flat selectors into clean SCSS blocks.',
        icon: 'bi-filetype-scss',
        category: 'CSS',
        status: 'live',
        premium: false,
    },

    // --- Code --------------------------------------------------------------
    {
        id: 'minify',
        slug: 'minify',
        name: 'HTML / CSS / JS Minifier',
        desc: 'Shrink HTML, CSS and JavaScript with fine-grained options and see the bytes you saved.',
        icon: 'bi-file-zip',
        category: 'Code',
        status: 'live',
        premium: false,
    },

    // --- Image ---------------------------------------------------------------
    {
        id: 'image-format',
        slug: 'image-format',
        name: 'Image Format & Compression',
        desc: 'Compress, resize and convert images between JPEG, PNG, WebP, AVIF and GIF in one pass.',
        icon: 'bi-arrow-repeat',
        category: 'Image',
        status: 'live',
        premium: false,
    },
    {
        id: 'image-upscale',
        slug: 'image-upscale',
        name: 'Image Upscale',
        desc: 'Upscale images up to 4× with high-quality Lanczos resampling.',
        icon: 'bi-aspect-ratio',
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
        name: 'Color Palette Studio',
        desc: 'Generate a harmonious palette from a seed colour, or extract one from any image.',
        icon: 'bi-palette',
        category: 'Color',
        status: 'live',
        premium: false,
    },

    // --- Text ----------------------------------------------------------------
    {
        id: 'text-image',
        slug: 'text-image',
        name: 'Text / Code → Image',
        desc: 'Render styled text or syntax-highlighted code as a downloadable, printable image.',
        icon: 'bi-fonts',
        category: 'Text',
        status: 'live',
        premium: false,
    },
    {
        id: 'whatsapp-format',
        slug: 'whatsapp-format',
        name: 'WhatsApp Text Formatter',
        desc: 'Add bold, italic, strikethrough, monospace and quotes to WhatsApp text with a live preview.',
        icon: 'bi-whatsapp',
        category: 'Text',
        status: 'live',
        premium: false,
    },

    // --- SEO -----------------------------------------------------------------
    // (The full SEO & design audit graduated to its own section at /seo.)
    {
        id: 'sitemap-gen',
        slug: 'sitemap',
        name: 'Sitemap & robots.txt Generator',
        desc: 'Build a valid sitemap.xml from your URLs and compose matching robots.txt rules.',
        icon: 'bi-diagram-2',
        category: 'SEO',
        status: 'live',
        premium: false,
    },

    // --- Generate ------------------------------------------------------------
    {
        id: 'qr-barcode',
        slug: 'qr-barcode',
        name: 'QR / Barcode Generator',
        desc: 'Generate customisable QR codes and barcodes with presets, colours and instant download.',
        icon: 'bi-qr-code',
        category: 'Generate',
        status: 'live',
        premium: false,
    },

    // --- Security / Encode ---------------------------------------------------
    {
        id: 'password-gen',
        slug: 'password-gen',
        name: 'Password & Passphrase Generator',
        desc: 'Create strong passwords or word-based passphrases in batches, and hash them with bcrypt or SHA.',
        icon: 'bi-key',
        category: 'Security',
        status: 'live',
        premium: false,
    },
    {
        id: 'url-codec',
        slug: 'url-codec',
        name: 'Encode / Decode Toolkit',
        desc: 'Encode and decode URL components, Base64, hex and HTML entities in one place.',
        icon: 'bi-link-45deg',
        category: 'Encode',
        status: 'live',
        premium: false,
    },
    {
        id: 'jwt-codec',
        slug: 'jwt-codec',
        name: 'JWT Encoder / Decoder',
        desc: 'Inspect, decode, sign and verify JSON Web Tokens.',
        icon: 'bi-shield-lock',
        category: 'Encode',
        status: 'live',
        premium: false,
    },

    // --- Utilities -------------------------------------------------------------
    {
        id: 'json-toolkit',
        slug: 'json',
        name: 'JSON Toolkit',
        desc: 'Format, validate, minify and sort JSON, or turn it into a TypeScript interface.',
        icon: 'bi-braces',
        category: 'Code',
        status: 'live',
        premium: false,
    },
    {
        id: 'regex-tester',
        slug: 'regex',
        name: 'Regex Tester',
        desc: 'Test regular expressions live with match highlighting, groups and a flags panel.',
        icon: 'bi-asterisk',
        category: 'Code',
        status: 'live',
        premium: false,
    },
    {
        id: 'diff-checker',
        slug: 'diff',
        name: 'Text Diff Checker',
        desc: 'Compare two texts line by line and see additions, deletions and changes highlighted.',
        icon: 'bi-file-diff',
        category: 'Text',
        status: 'live',
        premium: false,
    },
    {
        id: 'text-utils',
        slug: 'text-utils',
        name: 'Text Utilities',
        desc: 'Change case, slugify, count words and characters, and generate lorem ipsum.',
        icon: 'bi-type',
        category: 'Text',
        status: 'live',
        premium: false,
    },
    {
        id: 'timestamp',
        slug: 'timestamp',
        name: 'Timestamp Converter',
        desc: 'Convert between Unix epochs and human dates with timezone and relative views.',
        icon: 'bi-clock-history',
        category: 'Generate',
        status: 'live',
        premium: false,
    },
    {
        id: 'uuid-gen',
        slug: 'uuid',
        name: 'UUID / ULID Generator',
        desc: 'Generate UUID v4s, ULIDs and random IDs in bulk, with copy-all.',
        icon: 'bi-hash',
        category: 'Generate',
        status: 'live',
        premium: false,
    },
];
