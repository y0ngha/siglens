import { test as base, expect } from '@playwright/test';

const ALLOWED_HOSTS = new Set(['localhost:4300', '127.0.0.1:4300']);
const ALLOWED_PROTOCOLS = new Set(['data:', 'blob:', 'chrome-extension:']);

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
            // Explicit protocol allowlist so external ws/wss (and any non-http
            // scheme) is also guarded — only app-host requests and a handful of
            // browser-internal schemes are let through.
            const isAllowed =
                ALLOWED_PROTOCOLS.has(url.protocol) ||
                ALLOWED_HOSTS.has(url.host);
            if (isAllowed) return route.continue();
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
