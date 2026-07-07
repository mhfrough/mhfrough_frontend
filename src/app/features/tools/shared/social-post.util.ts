/**
 * Shared types/helpers for the Social Post Mockup tool. Pure data + formatting —
 * no DOM access — so it's safe to import from both the editor and the card
 * components without any SSR guards.
 */

export type SocialPlatform = 'instagram' | 'twitter' | 'facebook' | 'linkedin' | 'youtube';

export interface PlatformMeta {
    id: SocialPlatform;
    label: string;
    icon: string;
    /** Feed-post aspect ratio this platform is mocked up at (width / height). */
    aspect: number;
}

export const SOCIAL_PLATFORMS: PlatformMeta[] = [
    { id: 'instagram', label: 'Instagram', icon: 'bi-instagram', aspect: 1 },
    { id: 'twitter', label: 'X (Twitter)', icon: 'bi-twitter-x', aspect: 16 / 9 },
    { id: 'facebook', label: 'Facebook', icon: 'bi-facebook', aspect: 4 / 3 },
    { id: 'linkedin', label: 'LinkedIn', icon: 'bi-linkedin', aspect: 4 / 3 },
    { id: 'youtube', label: 'YouTube', icon: 'bi-youtube', aspect: 16 / 9 },
];

export interface PollOption {
    id: string;
    text: string;
    votes: number;
}

export interface SocialPostData {
    displayName: string;
    handle: string;
    avatarUrl: string | null;
    timestamp: string;
    imageUrl: string | null;
    caption: string;
    hashtags: string[];
    likes: number;
    comments: number;
    shares: number;
    pollEnabled: boolean;
    pollQuestion: string;
    pollOptions: PollOption[];
}

/** Parse a raw tag-input string ("#foo, bar baz") into normalised, deduped hashtag words. */
export function parseHashtags(input: string): string[] {
    return input
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#+/, '').trim())
        .filter(Boolean);
}

/** Compact "1.2K" / "3.4M" style formatting for like/comment/share counts. */
export function formatCount(n: number): string {
    if (!isFinite(n) || n < 1000) return String(Math.max(0, Math.round(n)));
    if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
}

/** Even-split percentages when nobody has "voted" yet, otherwise share-of-total, rounded. */
export function pollPercentages(options: PollOption[]): number[] {
    const total = options.reduce((sum, o) => sum + Math.max(0, o.votes), 0);
    if (total <= 0) return options.map(() => Math.round(100 / options.length));
    return options.map((o) => Math.round((Math.max(0, o.votes) / total) * 100));
}

/** Initials shown in the placeholder avatar when no image has been uploaded. */
export function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}
