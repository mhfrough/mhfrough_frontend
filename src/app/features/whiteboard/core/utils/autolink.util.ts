/**
 * Auto-linking for whiteboard text/sticky boxes: turns a plain URL into a real `<a>` as soon
 * as you finish typing it (a boundary character right after) or paste one in, matching the
 * live-linking convention of Notion/Slack/Google Docs.
 */

/** Bare http(s) URLs, or bare `www.` domains, greedy up to the next whitespace/angle-bracket. */
const URL_PATTERN = /(https?:\/\/[^\s<]+|www\.[^\s<]+\.[a-z]{2,}[^\s<]*)/i;
const FULL_URL_PATTERN = new RegExp(`^${URL_PATTERN.source}$`, 'i');

function hrefFor(matched: string): string {
    return /^https?:\/\//i.test(matched) ? matched : `https://${matched}`;
}

function styleAnchor(a: HTMLAnchorElement): void {
    // Inline styles, not a CSS class — this element is injected straight into innerHTML, not
    // rendered by Angular's template, so it never picks up this component's scoped stylesheet.
    a.style.color = 'var(--primary)';
    a.style.textDecoration = 'underline';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
}

/**
 * Core of both live-typing and trailing-URL linkification: if the text immediately before
 * `(text, endOffset)` ends in a bare URL not already inside a link, wraps it in a styled `<a>`
 * and returns it. Returns null (no-op) otherwise — safe to call speculatively.
 */
function linkifyBefore(text: Text, endOffset: number): HTMLAnchorElement | null {
    if (text.parentElement?.closest('a')) return null; // already linked
    const before = text.data.slice(0, endOffset);
    const match = before.match(new RegExp(URL_PATTERN.source + '$', 'i'));
    if (!match) return null;

    const linkRange = document.createRange();
    linkRange.setStart(text, endOffset - match[0].length);
    linkRange.setEnd(text, endOffset);

    const a = document.createElement('a');
    a.href = hrefFor(match[0]);
    styleAnchor(a);
    a.textContent = match[0];
    linkRange.deleteContents();
    linkRange.insertNode(a);
    return a;
}

/**
 * Called right after a boundary character (space/newline) is typed. Looks at the plain-text
 * token immediately before the caret; if it's a bare URL and isn't already inside a link,
 * wraps it in a styled `<a>`. No-ops otherwise — safe to call on every boundary keystroke.
 */
export function linkifyTokenBeforeCaret(root: HTMLElement): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const a = linkifyBefore(node as Text, range.startOffset);
    if (!a) return;

    // Restore the caret right after the newly-inserted link, where it logically was.
    const after = document.createRange();
    after.setStartAfter(a);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
}

/**
 * Called on blur/commit, i.e. when the user is done editing regardless of how — covers typing
 * a URL as the very last thing in the box and just clicking away, with no trailing space/Enter
 * to trigger `linkifyTokenBeforeCaret` and no selection left to anchor a caret restore to.
 */
export function linkifyTrailingUrl(root: HTMLElement): void {
    let last: Node | null = root;
    while (last && last.lastChild) last = last.lastChild;
    if (!last || last.nodeType !== Node.TEXT_NODE) return;
    linkifyBefore(last as Text, (last as Text).data.length);
}

/**
 * Called on paste. If the clipboard text is *purely* a URL (nothing else), inserts it as a
 * link instead of plain text and returns true (caller should preventDefault). Mixed content
 * ("check this out: https://...") falls through to normal paste — out of scope for v1.
 */
export function linkifyPastedUrl(plainText: string): HTMLAnchorElement | null {
    const trimmed = plainText.trim();
    if (!FULL_URL_PATTERN.test(trimmed)) return null;
    const a = document.createElement('a');
    a.href = hrefFor(trimmed);
    styleAnchor(a);
    a.textContent = trimmed;
    return a;
}
