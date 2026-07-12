import { test, expect } from '@playwright/test';

/**
 * Live pass over the blog richness features: category, TOC + scroll-spy,
 * captioned images, related posts. Requires seeded posts:
 * e2e-test-post-a (Essay, tags testing+automation, headings + figcaption),
 * e2e-test-post-b (Essay, tags automation), e2e-test-post-c (Tutorial).
 */

// Assertions target specific known posts rather than absolute counts — this
// runs against a live, shared DB that other content (real or agent-published)
// may also occupy.
test.describe('/blog list — category', () => {
    test('category chips filter posts and show badges', async ({ page }) => {
        await page.goto('/blog');
        await expect(page.locator('.blog-card', { hasText: 'E2E Test Post A' })).toBeVisible();
        await expect(page.locator('.blog-card', { hasText: 'E2E Test Post C' })).toBeVisible();

        await page.locator('.gallery-filter-tag', { hasText: 'Tutorial' }).click();
        await expect(page.locator('.blog-card', { hasText: 'E2E Test Post C' })).toBeVisible();
        await expect(page.locator('.blog-card', { hasText: 'E2E Test Post A' })).toHaveCount(0);
        await expect(page.locator('.blog-card', { hasText: 'E2E Test Post C' }).locator('.blog-category-badge'))
            .toHaveText('Tutorial');

        await page.locator('.gallery-filter-tag', { hasText: 'All Categories' }).click();
        await expect(page.locator('.blog-card', { hasText: 'E2E Test Post A' })).toBeVisible();
    });
});

test.describe('/blog/:slug — detail page', () => {
    test('category badge renders', async ({ page }) => {
        await page.goto('/blog/e2e-test-post-a');
        await expect(page.locator('.blog-detail-category')).toHaveText('Essay');
    });

    test('figure/figcaption from RTE caption renders inside content', async ({ page }) => {
        await page.goto('/blog/e2e-test-post-a');
        await expect(page.locator('.blog-detail-content figcaption')).toHaveText('A test caption');
    });

    test('table of contents renders and scroll-spy highlights active section', async ({ page }) => {
        await page.goto('/blog/e2e-test-post-a');

        const links = page.locator('.blog-toc-link');
        await expect(links).toHaveCount(8); // 2 h2 + 6 duplicate-text h3s (dedup-id case)
        await expect(links.nth(0)).toHaveText('First Section');
        await expect(links.nth(1)).toHaveText('Second Section');

        // Duplicate heading text must still resolve to unique hrefs (slugify dedupe).
        const hrefs = await links.evaluateAll(els => els.map(el => el.getAttribute('href')));
        expect(new Set(hrefs).size).toBe(hrefs.length);

        // Clicking a TOC link jumps to its heading and marks it active.
        await links.nth(1).click();
        await expect(page).toHaveURL(/#second-section/i);
        await expect(links.nth(1)).toHaveClass(/is-active/);

        // Jumping back up updates the active link too (not one-directional).
        await links.nth(0).click();
        await expect(page).toHaveURL(/#first-section/i);
        await expect(links.nth(0)).toHaveClass(/is-active/);
    });

    test('related posts show, scored by shared tag + category, excluding self', async ({ page }) => {
        await page.goto('/blog/e2e-test-post-a');

        const relatedGrid = page.locator('.blog-related-grid');
        await expect(relatedGrid.locator('.blog-title').first()).toBeVisible();

        // Post B shares both tag + category with A — must appear, and must rank
        // above Post C (category only) since it scores strictly higher.
        const titles = await relatedGrid.locator('.blog-title').allTextContents();
        expect(titles).toContain('E2E Test Post B');
        expect(titles).toContain('E2E Test Post C');
        expect(titles.indexOf('E2E Test Post B')).toBeLessThan(titles.indexOf('E2E Test Post C'));

        // Self must not appear in its own related list.
        expect(titles).not.toContain('E2E Test Post A');

        // Related card links to the right post.
        await relatedGrid.locator('.blog-card', { hasText: 'E2E Test Post B' }).click();
        await expect(page).toHaveURL(/\/blog\/e2e-test-post-b/);
    });
});
