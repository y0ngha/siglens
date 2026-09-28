// vi.mock → imports 순서 (MISTAKES.md Tests §17)
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getOptionsProvider (prod)', () => {
    afterEach(() => {
        vi.resetModules();
    });

    it('returns a YahooOptionsAdapter instance in prod', async () => {
        const { getOptionsProvider } =
            await import('@/entities/options-chain/lib/getOptionsProvider');
        const { YahooOptionsAdapter } =
            await import('@/entities/options-chain/lib/YahooOptionsAdapter');
        expect(getOptionsProvider()).toBeInstanceOf(YahooOptionsAdapter);
    });

    it('returns the same singleton across calls', async () => {
        const { getOptionsProvider } =
            await import('@/entities/options-chain/lib/getOptionsProvider');
        expect(getOptionsProvider()).toBe(getOptionsProvider());
    });

    it('singleton is reset between module reloads (vi.resetModules)', async () => {
        const { getOptionsProvider: get1 } =
            await import('@/entities/options-chain/lib/getOptionsProvider');
        vi.resetModules();
        vi.doMock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

        const { getOptionsProvider: get2 } =
            await import('@/entities/options-chain/lib/getOptionsProvider');
        // Different module instances → different singletons (module-level `cached` resets)
        expect(get1()).not.toBe(get2());
    });
});

// NOTE: The E2E branch (`require('./FakeOptionsDataProvider')`) is not tested here
// because vitest's ESM runner cannot resolve CJS `require()` relative paths
// (same constraint as getCongressTradesProvider.test.ts / getFundamentalDataProvider.test.ts).
// The E2E path is exercised by Playwright E2E tests that run the full Next.js server
// with E2E_TEST=1.
