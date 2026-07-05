import { WhiteboardElement } from '../models/element.model';
import { dashArrayFor } from '../models/style.model';
import { boundingBoxOfElements } from './hit-test.util';
import {
    arrowHeadPoints, diamondPoints, pathD, polygonPoints, starPoints, trianglePoints,
} from './shape-geometry.util';

const PADDING = 40;

/** Serialises the scene to a standalone SVG document string. */
export function exportSceneToSvg(elements: readonly WhiteboardElement[], background: string | null): string {
    const bbox = boundingBoxOfElements(elements);
    const x = bbox.x - PADDING;
    const y = bbox.y - PADDING;
    const w = Math.max(1, bbox.width + PADDING * 2);
    const h = Math.max(1, bbox.height + PADDING * 2);

    const bg = background ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${background}"/>` : '';
    const body = elements.map(el => renderNode(el)).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">
${bg}
${body}
</svg>`;
}

function renderNode(el: WhiteboardElement): string {
    const s = el.style;
    const dash = dashArrayFor(s);
    const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
    const common = `stroke="${s.strokeColor}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}"${dashAttr}`;
    const transform = `transform="translate(${el.x},${el.y}) rotate(${el.rotation},${el.width / 2},${el.height / 2})"`;

    switch (el.type) {
        case 'rectangle':
            return `<g ${transform}><rect width="${el.width}" height="${el.height}" rx="${s.cornerRadius}" fill="${s.fillColor}" ${common}/></g>`;
        case 'ellipse':
            return `<g ${transform}><ellipse cx="${el.width / 2}" cy="${el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${s.fillColor}" ${common}/></g>`;
        case 'diamond':
            return poly(transform, diamondPoints(el.width, el.height), s.fillColor, common);
        case 'triangle':
            return poly(transform, trianglePoints(el.width, el.height), s.fillColor, common);
        case 'star':
            return poly(transform, starPoints(el.width, el.height), s.fillColor, common);
        case 'polygon':
            return poly(transform, polygonPoints(el.width, el.height, el.sides), s.fillColor, common);
        case 'line':
        case 'pencil':
        case 'brush':
        case 'highlighter':
            return path(transform, el, common);
        case 'arrow':
            return path(transform, el, common) + arrowHead(transform, el, 'end');
        case 'double-arrow':
            return path(transform, el, common) + arrowHead(transform, el, 'end') + arrowHead(transform, el, 'start');
        case 'text':
            return renderText(el);
        case 'sticky':
            return renderSticky(el);
        case 'image':
            return renderImage(el);
        case 'frame':
            return renderFrame(el);
    }
}

function poly(transform: string, points: string, fill: string, common: string): string {
    return `<g ${transform}><polygon points="${points}" fill="${fill}" ${common}/></g>`;
}

function path(transform: string, el: WhiteboardElement, common: string): string {
    if (!('points' in el)) return '';
    const d = pathD(el.points.map(p => ({ x: p.x - el.x, y: p.y - el.y })));
    const width = el.type === 'brush' ? el.style.strokeWidth * 3 : el.type === 'highlighter' ? el.style.strokeWidth * 8 : el.style.strokeWidth;
    const opacity = el.type === 'highlighter' ? el.style.opacity * 0.35 : el.style.opacity;
    return `<g ${transform}><path d="${d}" fill="none" stroke="${el.style.strokeColor}" stroke-width="${width}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

function arrowHead(transform: string, el: WhiteboardElement, which: 'start' | 'end'): string {
    if (!('points' in el) || el.points.length < 2) return '';
    const pts = el.points;
    const [from, to] = which === 'end'
        ? [pts[pts.length - 2], pts[pts.length - 1]]
        : [pts[1], pts[0]];
    const head = arrowHeadPoints(
        { x: from.x - el.x, y: from.y - el.y },
        { x: to.x - el.x, y: to.y - el.y },
        Math.max(10, el.style.strokeWidth * 4),
    );
    return `<g ${transform}><polygon points="${head}" fill="${el.style.strokeColor}"/></g>`;
}

function renderText(el: Extract<WhiteboardElement, { type: 'text' }>): string {
    const lineHeight = el.fontSize * 1.3;
    const anchor = el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start';
    const anchorX = el.textAlign === 'center' ? el.width / 2 : el.textAlign === 'right' ? el.width : 0;
    const tspans = el.text.split('\n')
        .map((line, i) => `<tspan x="${anchorX}" dy="${i === 0 ? el.fontSize : lineHeight}">${escapeXml(line)}</tspan>`)
        .join('');
    const style = `font-family:${el.fontFamily};font-size:${el.fontSize}px;font-weight:${el.fontWeight};${el.italic ? 'font-style:italic;' : ''}${el.underline ? 'text-decoration:underline;' : ''}`;
    return `<g transform="translate(${el.x},${el.y}) rotate(${el.rotation},${el.width / 2},${el.height / 2})"><text fill="${el.color}" text-anchor="${anchor}" style="${style}" opacity="${el.style.opacity}">${tspans}</text></g>`;
}

function renderSticky(el: Extract<WhiteboardElement, { type: 'sticky' }>): string {
    const lineHeight = el.fontSize * 1.35;
    const tspans = el.text.split('\n')
        .map((line, i) => `<tspan x="12" dy="${i === 0 ? el.fontSize : lineHeight}">${escapeXml(line)}</tspan>`)
        .join('');
    return `<g transform="translate(${el.x},${el.y}) rotate(${el.rotation},${el.width / 2},${el.height / 2})"><rect width="${el.width}" height="${el.height}" rx="4" fill="${el.fill}" opacity="${el.style.opacity}"/><text x="12" y="12" fill="#1a1917" style="font-family:Inconsolata,'Courier New',monospace;font-size:${el.fontSize}px">${tspans}</text></g>`;
}

function renderImage(el: Extract<WhiteboardElement, { type: 'image' }>): string {
    const flips: string[] = [];
    if (el.flipH) flips.push(`translate(${el.width},0) scale(-1,1)`);
    if (el.flipV) flips.push(`translate(0,${el.height}) scale(1,-1)`);
    const flipAttr = flips.length ? ` transform="${flips.join(' ')}"` : '';
    return `<g transform="translate(${el.x},${el.y}) rotate(${el.rotation},${el.width / 2},${el.height / 2})"><image href="${el.src}" width="${el.width}" height="${el.height}" opacity="${el.style.opacity}" preserveAspectRatio="none"${flipAttr}/></g>`;
}

function renderFrame(el: Extract<WhiteboardElement, { type: 'frame' }>): string {
    // Fixed chrome look: frames ignore the element style.
    return `<g transform="translate(${el.x},${el.y}) rotate(${el.rotation},${el.width / 2},${el.height / 2})"><rect width="${el.width}" height="${el.height}" fill="transparent" stroke="#928e87" stroke-width="1.5" stroke-dasharray="6 4"/><text x="0" y="-8" fill="#928e87" font-size="12" font-family="Inconsolata, monospace">${escapeXml(el.label)}</text></g>`;
}

function escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
