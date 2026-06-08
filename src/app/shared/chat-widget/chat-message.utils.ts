/** Formats a duration in whole seconds as `mm:ss`, used by chat audio recorders. */
export function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

/**
 * Plain-text caption for a lightbox preview of a chat message.
 * Uses DOMParser (never attaches to the document) to strip HTML tags safely.
 */
export function lightboxCaption(msg: { content?: string | null } | null): string {
    if (!msg?.content) return '';
    if (msg.content.startsWith('[File:') && msg.content.endsWith(']')) return '';
    const doc = new DOMParser().parseFromString(msg.content, 'text/html');
    return doc.body.textContent?.trim() ?? '';
}
