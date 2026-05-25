/**
 * Branch coverage tests for seo.ts — targets uncovered:
 * - parseBuildDate with valid NEXT_BUILD_DATE
 * - parseBuildDate with invalid NEXT_BUILD_DATE
 */

describe('seo — parseBuildDate branches', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('uses NEXT_BUILD_DATE when env is a valid ISO date', async () => {
        vi.stubEnv('NEXT_BUILD_DATE', '2025-06-01T00:00:00Z');
        const { SITE_BUILD_DATE } = await import('@/shared/lib/seo');

        expect(SITE_BUILD_DATE.getTime()).toBe(
            new Date('2025-06-01T00:00:00Z').getTime()
        );
    });

    it('falls back to new Date() when NEXT_BUILD_DATE is invalid', async () => {
        vi.stubEnv('NEXT_BUILD_DATE', 'not-a-date');
        // Not using vi.useFakeTimers: the test verifies the fallback produces
        // a real "now" timestamp. Faking the clock would make before/after
        // identical to the fallback, defeating the bracket assertion.
        const before = Date.now();
        const { SITE_BUILD_DATE } = await import('@/shared/lib/seo');
        const after = Date.now();

        // Should fall back to current time
        expect(SITE_BUILD_DATE.getTime()).toBeGreaterThanOrEqual(before);
        expect(SITE_BUILD_DATE.getTime()).toBeLessThanOrEqual(after);
    });
});
