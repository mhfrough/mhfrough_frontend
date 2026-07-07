import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    PollOption,
    SocialPlatform,
    SocialPostData,
    formatCount,
    initialsOf,
    pollPercentages,
} from '../shared/social-post.util';

/** Stylized (not pixel-perfect) feed-post mockup, skinned per platform via a host class. */
@Component({
    selector: 'app-social-post-card',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './social-post-card.component.html',
    styleUrl: './social-post-card.component.scss',
    host: {
        '[class]': '"sp-card platform-" + platform',
    },
})
export class SocialPostCardComponent {
    @Input({ required: true }) platform!: SocialPlatform;
    @Input({ required: true }) data!: SocialPostData;

    readonly initials = computed(() => initialsOf(this.data.displayName));
    readonly percentages = computed(() => pollPercentages(this.data.pollOptions));
    readonly totalVotes = computed(() => this.data.pollOptions.reduce((s, o) => s + Math.max(0, o.votes), 0));
    readonly winningId = computed(() => {
        const opts = this.data.pollOptions;
        if (!opts.length) return null;
        return opts.reduce((best, o) => (o.votes > best.votes ? o : best), opts[0]).id;
    });

    trackOption = (_: number, o: PollOption) => o.id;

    percentFor(option: PollOption): number {
        const idx = this.data.pollOptions.findIndex((o) => o.id === option.id);
        return this.percentages()[idx] ?? 0;
    }

    formatCount(n: number): string {
        return formatCount(n);
    }
}
