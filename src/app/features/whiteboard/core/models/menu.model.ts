export type MenuItem =
    | { type: 'action'; label: string; icon?: string; shortcut?: string; danger?: boolean; disabled?: boolean; run: () => void }
    | { type: 'submenu'; label: string; icon?: string; items: MenuItem[] }
    | { type: 'sep' };
