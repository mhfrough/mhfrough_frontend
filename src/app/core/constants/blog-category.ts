/** Mirrors backend BlogCategory enum (mhfrough_backend/src/blogs/blog-category.enum.ts). */
export const BLOG_CATEGORIES = ['Essay', 'Tutorial', 'Guide', 'Case Study', 'Announcement', 'News'] as const;

export type BlogCategory = typeof BLOG_CATEGORIES[number];
