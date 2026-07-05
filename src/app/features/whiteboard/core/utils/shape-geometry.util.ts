import { Point } from '../models/viewport.model';

export function diamondPoints(w: number, h: number): string {
    return `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
}

export function trianglePoints(w: number, h: number): string {
    return `${w / 2},0 ${w},${h} 0,${h}`;
}

export function starPoints(w: number, h: number, spikes = 5): string {
    const cx = w / 2;
    const cy = h / 2;
    const outerR = Math.min(w, h) / 2;
    const innerR = outerR * 0.42;
    const pts: string[] = [];
    const step = Math.PI / spikes;
    let angle = -Math.PI / 2;
    for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        pts.push(`${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`);
        angle += step;
    }
    return pts.join(' ');
}

export function polygonPoints(w: number, h: number, sides = 6): string {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 2;
    const pts: string[] = [];
    const step = (Math.PI * 2) / sides;
    let angle = -Math.PI / 2;
    for (let i = 0; i < sides; i++) {
        pts.push(`${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`);
        angle += step;
    }
    return pts.join(' ');
}

export function pathD(points: Point[]): string {
    if (points.length === 0) return '';
    const [first, ...rest] = points;
    return `M ${first.x} ${first.y} ` + rest.map(p => `L ${p.x} ${p.y}`).join(' ');
}

/** Triangle points for an arrowhead at the end of the segment `from -> to`. */
export function arrowHeadPoints(from: Point, to: Point, size = 12): string {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const spread = Math.PI / 7;
    const p1 = { x: to.x - size * Math.cos(angle - spread), y: to.y - size * Math.sin(angle - spread) };
    const p2 = { x: to.x - size * Math.cos(angle + spread), y: to.y - size * Math.sin(angle + spread) };
    return `${to.x},${to.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`;
}
