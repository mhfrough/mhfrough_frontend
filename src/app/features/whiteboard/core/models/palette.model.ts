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
