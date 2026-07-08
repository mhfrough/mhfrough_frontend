import { test, expect } from '@playwright/test';

/**
 * Live end-to-end pass over the redesigned /seo audit page. Requires the
 * frontend dev server (and, for the "full report" test, the backend API) to
 * already be running — see playwright.config.ts for the base URL.
 */

test.describe('/seo audit page — visual redesign', () => {
    test('hero, eyebrow and CTA render with the premium styling', async ({ page }) => {
        await page.goto('/seo');

        await expect(page.locator('.sa-eyebrow')).toBeVisible();
        await expect(page.locator('.sa-title')).toHaveText('SEO Audit Suite');

        const runButton = page.locator('.sa-run');
        await expect(runButton).toBeVisible();
        const bg = await runButton.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('header gains elevation on scroll', async ({ page }) => {
        await page.goto('/seo');
        const header = page.locator('.seo-header');
        await expect(header).not.toHaveClass(/scrolled/);

        await page.evaluate(() => window.scrollTo(0, 400));
        await expect(header).toHaveClass(/scrolled/);
    });
});

test.describe('/seo audit page — full report', () => {
    test('running an audit renders the new sections and redirect CTAs', async ({ page }) => {
        await page.goto('/seo');
        await page.locator('.sa-url').fill('https://example.com');
        await page.locator('.sa-run').click();

        // The audit hits a real backend + real target URL — allow generous time.
        await expect(page.locator('.sa-scores')).toBeVisible({ timeout: 45_000 });

        const expectedSections = [
            'Domain & Network',
            'Build & Deploy Hygiene',
            'PWA Readiness',
            'Rendering (SSR/Hydration)',
            'Library Vulnerabilities',
        ];
        for (const label of expectedSections) {
            await expect(page.getByText(label, { exact: true })).toBeVisible();
        }

        // example.com has no sitemap/robots/favicon — the redirect CTA should appear.
        const ctas = page.locator('.sa-cta');
        expect(await ctas.count()).toBeGreaterThan(0);
        await expect(ctas.first()).toHaveAttribute('href', /\/tools\//);
    });
});
