/**
 * Shared helpers for locating "lines" inside a contenteditable region. Chrome/Edge wrap every
 * paragraph after the first in its own <div> on Enter, but the first line is left as loose
 * sibling nodes directly under the root — these helpers treat both shapes uniformly.
 */

/**
 * Direct child of `root` that contains a caret at (`node`, `offset`) — a contenteditable "line"
 * (its own <div> per Enter, or a bare node for the first line).
 *
 * `node` is usually a descendant text node, but a Range can also land with `node === root`
 * itself (e.g. `range.selectNodeContents(root); range.collapse(false)` — collapsing to the end
 * of an element with no explicit last-child target expresses the caret as a root-relative child
 * index, not a position inside a child). Walking "up from node until the parent is root" would,
 * in that case, walk *past* root into unrelated page ancestors instead of resolving to a line.
 */
export function findLineContainer(node: Node, offset: number, root: HTMLElement): Node {
    if (node === root) {
        if (root.childNodes.length === 0) return root;
        const idx = Math.min(offset, root.childNodes.length - 1);
        return root.childNodes[Math.max(0, idx)];
    }
    let n = node;
    while (n.parentNode && n.parentNode !== root) n = n.parentNode;
    return n;
}

export function firstTextNode(node: Node): Text | null {
    if (node.nodeType === Node.TEXT_NODE) return node as Text;
    for (let i = 0; i < node.childNodes.length; i++) {
        const found = firstTextNode(node.childNodes[i]);
        if (found) return found;
    }
    return null;
}

/** Every logical line in `root`, as a [first, last] pair of its bounding child nodes, in DOM order. */
export function enumerateLines(root: HTMLElement): { first: Node; last: Node }[] {
    const lines: { first: Node; last: Node }[] = [];
    let runStart: Node | null = null;
    let runEnd: Node | null = null;
    const flush = () => {
        if (runStart && runEnd) lines.push({ first: runStart, last: runEnd });
        runStart = null;
        runEnd = null;
    };
    for (const child of Array.from(root.childNodes)) {
        if (child.nodeName === 'DIV' || child.nodeName === 'P') {
            flush();
            lines.push({ first: child, last: child });
        } else if (child.nodeName === 'BR') {
            flush();
        } else {
            if (!runStart) runStart = child;
            runEnd = child;
        }
    }
    flush();
    return lines;
}

/**
 * Whether `sel` touches any part of `line`. Delegates to the browser's own
 * `Selection.containsNode` (partial containment) per node in the line instead of hand-rolled
 * `Range.compareBoundaryPoints` math — boundary-point comparisons are notoriously easy to get
 * backwards at exactly the position that matters here (line start/end), and a subtly-wrong
 * sign silently breaks every multi-line selection instead of throwing.
 */
export function lineTouchedBySelection(sel: Selection, line: { first: Node; last: Node }): boolean {
    let n: Node | null = line.first;
    while (n) {
        if (sel.containsNode(n, true)) return true;
        if (n === line.last) break;
        n = n.nextSibling;
    }
    return false;
}

const CHECKLIST_GLYPH = /^[☐☑]/;
/** Length of the glyph marker including its trailing space ("☐ " / "☑ "), or 1 if there's no space. */
export function glyphMarkerLength(text: string): number {
    return text.length > 1 && text[1] === ' ' ? 2 : 1;
}

export function isChecklistLine(text: string): boolean {
    return CHECKLIST_GLYPH.test(text);
}
