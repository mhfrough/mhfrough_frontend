export type ToolId =
    | 'selection'
    | 'rectangle'
    | 'rounded-rectangle'
    | 'ellipse'
    | 'circle'
    | 'diamond'
    | 'triangle'
    | 'polygon'
    | 'star'
    | 'line'
    | 'arrow'
    | 'double-arrow'
    | 'pencil'
    | 'brush'
    | 'highlighter'
    | 'text'
    | 'sticky'
    | 'code'
    | 'image'
    | 'frame';

export interface ToolDef {
    id: ToolId;
    label: string;
    icon: string;
    shortcut: string;
}

export const TOOL_DEFS: ToolDef[] = [
    { id: 'selection', label: 'Selection', icon: 'bi-cursor', shortcut: 'V' },
    { id: 'rectangle', label: 'Rectangle', icon: 'bi-square', shortcut: 'R' },
    { id: 'rounded-rectangle', label: 'Rounded Rectangle', icon: 'bi-app', shortcut: 'Shift+R' },
    { id: 'ellipse', label: 'Ellipse', icon: 'bi-egg', shortcut: 'O' },
    { id: 'circle', label: 'Circle', icon: 'bi-circle', shortcut: 'Shift+O' },
    { id: 'diamond', label: 'Diamond', icon: 'bi-suit-diamond', shortcut: 'D' },
    { id: 'triangle', label: 'Triangle', icon: 'bi-triangle', shortcut: 'T' },
    { id: 'polygon', label: 'Polygon', icon: 'bi-hexagon', shortcut: 'P' },
    { id: 'star', label: 'Star', icon: 'bi-star', shortcut: 'S' },
    { id: 'line', label: 'Line', icon: 'bi-slash-lg', shortcut: 'L' },
    { id: 'arrow', label: 'Arrow', icon: 'bi-arrow-up-right', shortcut: 'A' },
    { id: 'double-arrow', label: 'Double Arrow', icon: 'bi-arrow-left-right', shortcut: 'Shift+A' },
    { id: 'pencil', label: 'Pencil', icon: 'bi-pencil', shortcut: 'N' },
    { id: 'brush', label: 'Brush', icon: 'bi-brush', shortcut: 'B' },
    { id: 'highlighter', label: 'Highlighter', icon: 'bi-highlighter', shortcut: 'H' },
    { id: 'text', label: 'Text', icon: 'bi-fonts', shortcut: 'X' },
    { id: 'sticky', label: 'Sticky Note', icon: 'bi-sticky', shortcut: 'K' },
    { id: 'code', label: 'Code Block', icon: 'bi-code-square', shortcut: 'C' },
    { id: 'image', label: 'Image', icon: 'bi-image', shortcut: 'I' },
    { id: 'frame', label: 'Frame', icon: 'bi-aspect-ratio', shortcut: 'F' },
];
