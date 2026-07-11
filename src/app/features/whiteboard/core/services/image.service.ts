import { Injectable } from '@angular/core';
import { ImageElement, generateElementId } from '../models/element.model';
import { DEFAULT_STYLE } from '../models/style.model';
import { SceneService } from './scene.service';
import { HistoryService } from './history.service';

const ACCEPTED_TYPES: ReadonlySet<string> = new Set([
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Longest side of a freshly-placed image, in world units. */
const MAX_PLACED_SIDE = 480;
/**
 * Rasters get downscaled/re-encoded before storage: the scene (data URLs included) is
 * JSON.stringify'd into localStorage on every autosave, and that quota is ~5MB shared
 * with the rest of the site — a single uncompressed phone photo would eat all of it.
 */
const MAX_STORED_SIDE = 1600;
const RECOMPRESS_OVER_BYTES = 300 * 1024;
const WEBP_QUALITY = 0.85;
/** Formats kept verbatim: SVG (vector/text) and GIF (re-encoding drops animation). */
const NO_RECOMPRESS: ReadonlySet<string> = new Set(['image/svg+xml', 'image/gif']);

/** Turns picked / dropped / pasted image files into ImageElements on the scene. */
@Injectable()
export class ImageService {
    constructor(
        private readonly scene: SceneService,
        private readonly history: HistoryService,
    ) {}

    /** Validates, reads and places a single image file centered on `dropWorldPoint` (or the origin). */
    async addImageFromFile(file: File, dropWorldPoint?: { x: number; y: number }): Promise<void> {
        await this.tryAddImage(file, dropWorldPoint ?? { x: 0, y: 0 });
    }

    /** Places every accepted image file in the transfer. Returns true if at least one was handled. */
    async addImagesFromDataTransfer(dt: DataTransfer, worldPoint: { x: number; y: number }): Promise<boolean> {
        let handled = false;
        for (const file of Array.from(dt.files)) {
            if (await this.tryAddImage(file, worldPoint)) handled = true;
        }
        return handled;
    }

    private async tryAddImage(file: File, worldPoint: { x: number; y: number }): Promise<boolean> {
        if (!ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) return false;

        let src: string;
        let img: HTMLImageElement;
        try {
            src = await this.readAsDataUrl(file);
            img = await this.loadImage(src);
            const compressed = this.compress(file, img, src);
            if (compressed) {
                src = compressed;
                img = await this.loadImage(src);
            }
        } catch {
            return false;
        }

        // SVGs without intrinsic dimensions report 0x0; fall back to a sane box.
        const naturalWidth = img.naturalWidth || 300;
        const naturalHeight = img.naturalHeight || 150;
        const scale = Math.min(1, MAX_PLACED_SIDE / Math.max(naturalWidth, naturalHeight));
        const width = naturalWidth * scale;
        const height = naturalHeight * scale;
        const now = Date.now();

        const el: ImageElement = {
            id: generateElementId(),
            type: 'image',
            x: worldPoint.x - width / 2,
            y: worldPoint.y - height / 2,
            width,
            height,
            rotation: 0,
            style: { ...DEFAULT_STYLE },
            locked: false,
            groupId: null,
            createdAt: now,
            updatedAt: now,
            src,
            naturalWidth,
            naturalHeight,
            flipH: false,
            flipV: false,
        };
        this.scene.addElement(el);
        this.history.commit();
        return true;
    }

    /**
     * Downscale + re-encode a raster to WebP (alpha preserved) when it's large enough to
     * matter. Returns null when the original should be kept (small file, SVG/GIF, or the
     * re-encode came out bigger — possible for tiny PNGs / already-optimized WebP).
     */
    private compress(file: File, img: HTMLImageElement, originalSrc: string): string | null {
        if (NO_RECOMPRESS.has(file.type)) return null;
        const oversized = img.naturalWidth > MAX_STORED_SIDE || img.naturalHeight > MAX_STORED_SIDE;
        if (!oversized && file.size <= RECOMPRESS_OVER_BYTES) return null;

        const scale = Math.min(1, MAX_STORED_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        try {
            const webp = canvas.toDataURL('image/webp', WEBP_QUALITY);
            return webp.length < originalSrc.length ? webp : null;
        } catch {
            return null;
        }
    }

    private readAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.readAsDataURL(file);
        });
    }

    private loadImage(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to decode image'));
            img.src = src;
        });
    }
}
