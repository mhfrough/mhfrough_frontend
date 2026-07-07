import { MenuItem } from '../models/menu.model';

const ITEM_H = 32;
const SEP_H = 9;
const MENU_W = 208;
const MARGIN = 8;

export function estimateMenuHeight(items: MenuItem[]): number {
    return items.reduce((h, it) => h + (it.type === 'sep' ? SEP_H : ITEM_H), 8);
}

/** Clamp a top-level (root) menu so it stays fully on-screen, flipping up/left as needed. */
export function clampRootMenuPos(x: number, y: number, items: MenuItem[]): { x: number; y: number } {
    const h = Math.min(estimateMenuHeight(items), window.innerHeight - MARGIN * 2);
    const w = MENU_W;
    let left = x;
    let top = y;
    if (left + w > window.innerWidth - MARGIN) left = x - w;
    if (top + h > window.innerHeight - MARGIN) top = y - h;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - w - MARGIN));
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - h - MARGIN));
    return { x: left, y: top };
}

/** Position a submenu flyout beside its trigger row, flipping to the left / upward when it would overflow. */
export function clampSubmenuPos(anchor: DOMRect, items: MenuItem[]): { x: number; y: number } {
    const h = Math.min(estimateMenuHeight(items), window.innerHeight - MARGIN * 2);
    const w = MENU_W;
    let left = anchor.right - 2;
    if (left + w > window.innerWidth - MARGIN) left = anchor.left - w + 2;
    left = Math.max(MARGIN, left);
    let top = anchor.top - 6;
    if (top + h > window.innerHeight - MARGIN) top = window.innerHeight - h - MARGIN;
    top = Math.max(MARGIN, top);
    return { x: left, y: top };
}
