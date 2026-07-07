import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { TOOL_DEFS, ToolDef } from '../../core/models/tool.model';
import { ToolService } from '../../core/services/tool.service';

@Component({
    selector: 'app-wb-toolbar',
    standalone: true,
    imports: [],
    templateUrl: './wb-toolbar.component.html',
    styleUrl: './wb-toolbar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WbToolbarComponent {
    readonly tools: ToolDef[] = TOOL_DEFS;

    /** Image isn't a persistent tool mode — picking it fires this immediately (see canvas-board). */
    @Output() readonly imageTool = new EventEmitter<void>();

    constructor(readonly toolService: ToolService) {}

    pick(tool: ToolDef): void {
        if (tool.id === 'image') this.imageTool.emit();
        else this.toolService.setTool(tool.id);
    }
}
