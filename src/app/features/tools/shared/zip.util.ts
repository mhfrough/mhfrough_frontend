import JSZip from 'jszip';

export interface ZipEntry {
    path: string;
    data: Blob | string;
}

export async function buildZip(entries: ZipEntry[]): Promise<Blob> {
    const zip = new JSZip();
    for (const entry of entries) {
        zip.file(entry.path, entry.data);
    }
    return zip.generateAsync({ type: 'blob' });
}
