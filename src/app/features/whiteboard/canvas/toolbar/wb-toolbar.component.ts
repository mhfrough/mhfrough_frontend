import { ChangeDetectionStrategy, Component } from '@angular/core';
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

    constructor(readonly toolService: ToolService) {}
}
