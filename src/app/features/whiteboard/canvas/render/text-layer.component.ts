import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { StickyElement, TextElement, WhiteboardElement } from '../../core/models/element.model';
import { SceneService } from '../../core/services/scene.service';
import { HistoryService } from '../../core/services/history.service';

/** Renders text & sticky-note elements as editable HTML overlays (so native contenteditable + fonts apply). */
@Component({
    selector: 'app-text-layer',
    standalone: true,
    imports: [],
    templateUrl: './text-layer.component.html',
    styleUrl: './text-layer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextLayerComponent {
    @Input({ required: true }) elements: WhiteboardElement[] = [];

    constructor(private readonly scene: SceneService, private readonly history: HistoryService) {}

    isText(el: WhiteboardElement): el is TextElement {
        return el.type === 'text';
    }

    isSticky(el: WhiteboardElement): el is StickyElement {
        return el.type === 'sticky';
    }

    commitText(id: string, target: EventTarget | null): void {
        const div = target as HTMLDivElement;
        this.scene.updateElement(id, { text: div.innerText } as Partial<WhiteboardElement>);
        this.history.commit();
    }

    stop(e: Event): void {
        e.stopPropagation();
    }
}
