import { Injectable, Signal, computed } from '@angular/core';
import { SceneService } from './scene.service';
import { SelectionService } from './selection.service';
import { SelectionInteractionService } from './selection-interaction.service';
import { boundingBoxOfElements } from '../utils/hit-test.util';

export interface Guide {
    axis: 'v' | 'h';
    /** World coordinate of the guide line (x for vertical, y for horizontal). */
    position: number;
    /** World extent of the line on the other axis (min). */
    from: number;
    /** World extent of the line on the other axis (max). */
    to: number;
}

/** Alignment tolerance in world units — guides visualize (near-)equality, snapping makes it exact. */
const THRESHOLD = 1;
/** Perf cap: only the first N non-selected elements are considered as alignment candidates. */
const MAX_CANDIDATES = 300;
const MAX_GUIDES = 6;

/**
 * Smart alignment guides: while a move drag is in progress, compares the moving selection's
 * bounding-box edges + centers against every other element's edges + centers and emits the
 * matching lines in world coordinates.
 */
@Injectable()
export class GuidesService {
    constructor(
        private readonly scene: SceneService,
        private readonly selection: SelectionService,
        private readonly interaction: SelectionInteractionService,
    ) {}

    readonly guides: Signal<Guide[]> = computed(() => {
        if (this.interaction.mode() !== 'move') return [];

        const selected = this.selection.selectedElements();
        if (selected.length === 0) return [];

        const moving = boundingBoxOfElements(selected);
        const selectedIds = this.selection.selectedIds();
        const others = this.scene.elements()
            .filter(el => !selectedIds.has(el.id))
            .slice(0, MAX_CANDIDATES);

        const movingV = edgesAndCenter(moving.x, moving.width);
        const movingH = edgesAndCenter(moving.y, moving.height);

        const found = new Map<string, Guide>();

        for (const other of others) {
            const otherV = edgesAndCenter(other.x, other.width);
            const otherH = edgesAndCenter(other.y, other.height);

            for (const mv of movingV) {
                for (const ov of otherV) {
                    if (Math.abs(mv - ov) > THRESHOLD) continue;
                    addOrExtend(found, {
                        axis: 'v',
                        position: ov,
                        from: Math.min(moving.y, other.y),
                        to: Math.max(moving.y + moving.height, other.y + other.height),
                    });
                }
            }

            for (const mh of movingH) {
                for (const oh of otherH) {
                    if (Math.abs(mh - oh) > THRESHOLD) continue;
                    addOrExtend(found, {
                        axis: 'h',
                        position: oh,
                        from: Math.min(moving.x, other.x),
                        to: Math.max(moving.x + moving.width, other.x + other.width),
                    });
                }
            }

            if (found.size >= MAX_GUIDES) break;
        }

        return [...found.values()].slice(0, MAX_GUIDES);
    });
}

/** left/cx/right (or top/cy/bottom) for a box side. */
function edgesAndCenter(start: number, size: number): readonly [number, number, number] {
    return [start, start + size / 2, start + size];
}

/** Dedupe by axis + rounded position; a repeated guide extends the existing line's extent. */
function addOrExtend(map: Map<string, Guide>, guide: Guide): void {
    const key = `${guide.axis}:${Math.round(guide.position)}`;
    const existing = map.get(key);
    if (existing) {
        existing.from = Math.min(existing.from, guide.from);
        existing.to = Math.max(existing.to, guide.to);
    } else {
        map.set(key, { ...guide });
    }
}
