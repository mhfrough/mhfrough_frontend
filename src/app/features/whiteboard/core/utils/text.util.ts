/** Plain-text rendering of a rich-text field (used by raster/SVG export and layer name previews). */
export function stripHtml(html: string): string {
    // contenteditable represents new lines as <div>...</div> (Chrome/Edge) and soft breaks as <br>.
    const normalized = html
        .replace(/<div[^>]*>/gi, '\n')
        .replace(/<\/div>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n');
    const div = document.createElement('div');
    div.innerHTML = normalized;
    return (div.textContent ?? '').replace(/^\n+/, '').replace(/\n{2,}/g, '\n');
}
