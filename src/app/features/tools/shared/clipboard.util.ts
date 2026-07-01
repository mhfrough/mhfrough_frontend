/**
 * SSR-safe browser helpers shared by the tool components. Callers must already
 * be running in the browser (guard with isPlatformBrowser before invoking).
 */

/** Copy text to the clipboard; returns true on success. */
export async function copyText(text: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/** Trigger a client-side download of `text` as a file named `filename`. */
export function downloadText(text: string, filename: string, mime = 'text/plain'): void {
    if (typeof document === 'undefined' || typeof URL === 'undefined') return;
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** Trigger a client-side download from a data URL (e.g. canvas / image bytes). */
export function downloadDataUrl(dataUrl: string, filename: string): void {
    if (typeof document === 'undefined') return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
