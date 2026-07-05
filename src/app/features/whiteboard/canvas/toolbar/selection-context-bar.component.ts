import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SelectionService } from '../../core/services/selection.service';

/** Floating action bar for the current selection: order, lock, group, align, distribute, duplicate, delete. */
@Component({
    selector: 'app-selection-context-bar',
    standalone: true,
    imports: [],
    templateUrl: './selection-context-bar.component.html',
    styleUrl: './selection-context-bar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionContextBarComponent {
    constructor(readonly selection: SelectionService) {}

    readonly isMulti = () => this.selection.selectedElements().length > 1;
    readonly isGrouped = () => this.selection.selectedElements().some(el => el.groupId);
}
