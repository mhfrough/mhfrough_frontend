export interface Rgba {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface Hsv {
    h: number;
    s: number;
    v: number;
}

const clampByte = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Parse hex (#rgb / #rgba / #rrggbb / #rrggbbaa), rgb()/rgba(), or "transparent" into RGBA. */
export function parseColor(input: string | null | undefined): Rgba {
    if (!input) return { r: 0, g: 0, b: 0, a: 1 };
    const s = input.trim().toLowerCase();
    if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

    if (s.startsWith('#')) {
        let hex = s.slice(1);
        if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        if ([r, g, b].some(Number.isNaN)) return { r: 0, g: 0, b: 0, a: 1 };
        return { r, g, b, a };
    }

    const m = s.match(/rgba?\(([^)]+)\)/);
    if (m) {
        const p = m[1].split(',').map(x => parseFloat(x.trim()));
        return { r: clampByte(p[0] || 0), g: clampByte(p[1] || 0), b: clampByte(p[2] || 0), a: p[3] === undefined ? 1 : clamp01(p[3]) };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
}

export function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => clampByte(x).toString(16).padStart(2, '0')).join('');
}

/** Canonical string for storage: hex when fully opaque, else rgba(). */
export function toColorString(c: Rgba): string {
    const a = clamp01(c.a);
    if (a >= 1) return rgbToHex(c.r, c.g, c.b);
    return `rgba(${clampByte(c.r)}, ${clampByte(c.g)}, ${clampByte(c.b)}, ${Math.round(a * 100) / 100})`;
}

/** Opaque CSS rgb() string, ignoring alpha — for swatch fills over a checkerboard. */
export function rgbString(c: Rgba): string {
    return `rgb(${clampByte(c.r)}, ${clampByte(c.g)}, ${clampByte(c.b)})`;
}

export function rgbToHsv(r: number, g: number, b: number): Hsv {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === rn) h = ((gn - bn) / d) % 6;
        else if (max === gn) h = (bn - rn) / d + 2;
        else h = (rn - gn) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    return { h, s, v: max };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return { r: clampByte((r + m) * 255), g: clampByte((g + m) * 255), b: clampByte((b + m) * 255) };
}
