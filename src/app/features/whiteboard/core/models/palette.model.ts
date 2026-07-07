export const STROKE_PALETTE: readonly string[] = [
    '#e4e0d8', '#1a1917', '#6366f1', '#818cf8', '#4ade80',
    '#22c55e', '#f59e0b', '#d97706', '#dc2626', '#f87171',
];

export const FILL_PALETTE: readonly string[] = [
    'transparent', '#242220', '#6366f1', '#818cf8', '#4ade80',
    '#22c55e', '#f59e0b', '#d97706', '#dc2626', '#f87171',
];

export const STICKY_PALETTE: readonly string[] = [
    '#d97706', '#f59e0b', '#4ade80', '#6366f1', '#818cf8', '#dc2626', '#e4e0d8',
];

/** The site's theme typeface (mirrors `--font` in styles.scss). Default for new text/notes. */
export const THEME_FONT = '"Inconsolata", "Courier New", monospace';

export const FONT_FAMILIES: readonly { label: string; value: string }[] = [
    { label: 'Theme', value: THEME_FONT },
    { label: 'Sans', value: 'Inter, sans-serif' },
    { label: 'Serif', value: 'Georgia, serif' },
    { label: 'Mono', value: 'ui-monospace, monospace' },
    { label: 'Hand', value: '"Comic Sans MS", cursive' },
];

/**
 * Default look for the Code Block tool: a monospace font on a shaded card, like a markdown
 * code fence. Deliberately `--bg` (#1a1917), not `--bg-alt`/`--surface` (#242220) — the
 * canvas surface itself renders at `--bg-alt` (.wb-surface in canvas-board.component.scss),
 * so a fill matching that token is literally invisible against it, not just low-contrast.
 * `--bg` reads as a slightly recessed "well" instead, with a hairline border for definition
 * (see .wb-text-el--filled) — matching the theme's own "borders carry hierarchy" principle.
 */
export const CODE_BLOCK_FONT = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
export const CODE_BLOCK_FILL = '#1a1917';

/** Standard 9-step type-scale weights (Figma/Adobe XD convention), not just a Bold on/off toggle. */
export const FONT_WEIGHTS: readonly { label: string; value: number }[] = [
    { label: 'Thin', value: 100 },
    { label: 'Extra Light', value: 200 },
    { label: 'Light', value: 300 },
    { label: 'Regular', value: 400 },
    { label: 'Medium', value: 500 },
    { label: 'Semi Bold', value: 600 },
    { label: 'Bold', value: 700 },
    { label: 'Extra Bold', value: 800 },
    { label: 'Black', value: 900 },
];
