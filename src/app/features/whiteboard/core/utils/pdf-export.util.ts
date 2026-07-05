export type PageSize = 'A4' | 'A3' | 'Letter';
export type Orientation = 'portrait' | 'landscape';

/** Page dimensions in PDF points (1/72 inch). */
const PAGE_POINTS: Record<PageSize, [number, number]> = {
    A4: [595.28, 841.89],
    A3: [841.89, 1190.55],
    Letter: [612, 792],
};

/**
 * Builds a minimal single-page PDF that embeds a JPEG, scaled to fit the page
 * with margins. No external deps — writes the PDF byte structure by hand.
 */
export function buildJpegPdf(
    jpegBytes: Uint8Array,
    imgWidth: number,
    imgHeight: number,
    size: PageSize,
    orientation: Orientation,
): Blob {
    let [pw, ph] = PAGE_POINTS[size];
    if (orientation === 'landscape') [pw, ph] = [ph, pw];

    const margin = 36;
    const maxW = pw - margin * 2;
    const maxH = ph - margin * 2;
    const scale = Math.min(maxW / imgWidth, maxH / imgHeight);
    const drawW = imgWidth * scale;
    const drawH = imgHeight * scale;
    const offsetX = (pw - drawW) / 2;
    const offsetY = (ph - drawH) / 2;

    const header = '%PDF-1.4\n';
    const objects: string[] = [];
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    objects.push(`<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`);
    const content = `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${offsetX.toFixed(2)} ${offsetY.toFixed(2)} cm /Im0 Do Q`;

    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];
    const offsets: number[] = [];
    let cursor = 0;

    const pushStr = (str: string) => {
        const bytes = encoder.encode(str);
        parts.push(bytes);
        cursor += bytes.length;
    };
    const pushBytes = (bytes: Uint8Array) => {
        parts.push(bytes);
        cursor += bytes.length;
    };

    pushStr(header);

    // Objects 1-3 (catalog, pages, page)
    for (let i = 0; i < 3; i++) {
        offsets[i] = cursor;
        pushStr(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
    }

    // Object 4: image stream (binary JPEG)
    offsets[3] = cursor;
    pushStr(`4 0 obj\n${objects[3]}\nstream\n`);
    pushBytes(jpegBytes);
    pushStr('\nendstream\nendobj\n');

    // Object 5: content stream
    offsets[4] = cursor;
    const contentBytes = encoder.encode(content);
    pushStr(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream\nendobj\n`);

    // xref
    const xrefStart = cursor;
    let xref = `xref\n0 6\n0000000000 65535 f \n`;
    for (let i = 0; i < 5; i++) {
        xref += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
    }
    pushStr(xref);
    pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

    return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}
