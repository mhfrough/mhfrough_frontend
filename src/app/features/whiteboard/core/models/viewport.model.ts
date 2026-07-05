export interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

export interface Point {
    x: number;
    y: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const DEFAULT_ZOOM = 1;
