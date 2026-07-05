export type DashStyle = 'solid' | 'dashed' | 'dotted';

export interface ElementStyle {
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    opacity: number;
    dash: DashStyle;
    cornerRadius: number;
}

export const DEFAULT_STYLE: ElementStyle = {
    strokeColor: '#e4e0d8',
    fillColor: 'transparent',
    strokeWidth: 2,
    opacity: 1,
    dash: 'solid',
    cornerRadius: 0,
};

export const STICKY_DEFAULT_FILL = '#d97706';

export function dashArrayFor(style: ElementStyle): string | null {
    if (style.dash === 'dashed') return `${style.strokeWidth * 4} ${style.strokeWidth * 3}`;
    if (style.dash === 'dotted') return `${style.strokeWidth} ${style.strokeWidth * 2.5}`;
    return null;
}
