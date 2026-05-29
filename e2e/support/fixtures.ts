import { test as base, expect } from '@playwright/test';

const ALLOWED_HOSTS = new Set(['localhost:4300', '127.0.0.1:4300']);

/**
 * Wraps the page so any browser request to a non-app host fails the test.
 * Catches stubbing drift and prevents accidental real external API calls.
 * Server-side fetches (FMP/LLM/etc.) are not visible here — those are handled
 * by E2E_TEST fake-provider injection.
 */
export const test = base.extend({
    page: async ({ page }, use) => {
        const violations: string[] = [];
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            const isAppOrLocalScheme =
                !url.protocol.startsWith('http') || ALLOWED_HOSTS.has(url.host);
            if (isAppOrLocalScheme) return route.continue();
            violations.push(url.href);
            return route.abort();
        });
        await use(page);
        expect(
            violations,
            `Unstubbed external requests: ${violations.join(', ')}`
        ).toEqual([]);
    },
});

export { expect };
