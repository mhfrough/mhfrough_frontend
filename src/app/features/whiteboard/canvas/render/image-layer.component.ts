import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ImageElement, WhiteboardElement, isImageElement } from '../../core/models/element.model';

/**
 * Renders image elements as an HTML overlay inside the transformed `.wb-scene` container.
 * Purely presentational: hit-testing / selection / moving is handled by the board,
 * so the whole layer is pointer-events: none.
 */
@Component({
    selector: 'app-image-layer',
    standalone: true,
    imports: [],
    templateUrl: './image-layer.component.html',
    styleUrl: './image-layer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageLayerComponent {
    @Input({ required: true }) elements: WhiteboardElement[] = [];

    isImage(el: WhiteboardElement): el is ImageElement {
        return isImageElement(el);
    }

    imageTransform(el: ImageElement): string | null {
        const parts: string[] = [];
        const rx = el.rotationX ?? 0;
        const ry = el.rotationY ?? 0;
        if (rx || ry) parts.push(`perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`);
        if (el.rotation !== 0) parts.push(`rotate(${el.rotation}deg)`);
        if (el.flipH) parts.push('scaleX(-1)');
        if (el.flipV) parts.push('scaleY(-1)');
        return parts.length ? parts.join(' ') : null;
    }
}
