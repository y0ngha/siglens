import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

describe('getCongressTradesProvider (prod)', () => {
    afterEach(() => {
        vi.resetModules();
    });

    it('returns a CachedCongressTradesProvider instance in prod', async () => {
        const { getCongressTradesProvider } =
            await import('@/shared/api/fmp/getCongressTradesProvider');
        const { CachedCongressTradesProvider } =
            await import('@/shared/api/fmp/CachedCongressTradesProvider');
        expect(getCongressTradesProvider()).toBeInstanceOf(
            CachedCongressTradesProvider
        );
    });

    it('returns the same singleton across calls', async () => {
        const { getCongressTradesProvider } =
            await import('@/shared/api/fmp/getCongressTradesProvider');
        expect(getCongressTradesProvider()).toBe(getCongressTradesProvider());
    });

    it('singleton is reset between module reloads (vi.resetModules)', async () => {
        const { getCongressTradesProvider: get1 } =
            await import('@/shared/api/fmp/getCongressTradesProvider');
        vi.resetModules();
        vi.doMock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

        const { getCongressTradesProvider: get2 } =
            await import('@/shared/api/fmp/getCongressTradesProvider');
        // Different module instances → different singletons (module-level `cached` resets)
        expect(get1()).not.toBe(get2());
    });
});

// NOTE: The E2E branch (`require('./FakeCongressTradesProvider')`) is not tested
// here because vitest's ESM runner cannot resolve CJS `require()` relative paths
// (same constraint as getFinancialStatementsProvider.test.ts and getFundamentalDataProvider.test.ts).
// The E2E path is exercised by Playwright E2E tests that run the full Next.js server
// with E2E_TEST=1.
