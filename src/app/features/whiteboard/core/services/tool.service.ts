import { Injectable, signal } from '@angular/core';
import { ToolId } from '../models/tool.model';
import { DEFAULT_STYLE, ElementStyle } from '../models/style.model';

/** Owns the currently-active tool and the default style applied to new elements. */
@Injectable()
export class ToolService {
    readonly activeTool = signal<ToolId>('selection');
    readonly keepToolActive = signal(false);
    readonly style = signal<ElementStyle>({ ...DEFAULT_STYLE });

    setTool(tool: ToolId): void {
        this.activeTool.set(tool);
    }

    finishDraw(): void {
        if (!this.keepToolActive()) {
            this.activeTool.set('selection');
        }
    }

    updateStyle(patch: Partial<ElementStyle>): void {
        this.style.update(s => ({ ...s, ...patch }));
    }
}
