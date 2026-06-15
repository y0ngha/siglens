import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

describe('getFinancialStatementsProvider (prod)', () => {
    afterEach(() => {
        vi.resetModules();
    });

    it('returns a CachedFinancialStatementsProvider instance in prod', async () => {
        const { getFinancialStatementsProvider } =
            await import('@/shared/api/fmp/getFinancialStatementsProvider');
        const { CachedFinancialStatementsProvider } =
            await import('@/shared/api/fmp/CachedFinancialStatementsProvider');
        expect(getFinancialStatementsProvider()).toBeInstanceOf(
            CachedFinancialStatementsProvider
        );
    });

    it('returns the same singleton across calls', async () => {
        const { getFinancialStatementsProvider } =
            await import('@/shared/api/fmp/getFinancialStatementsProvider');
        expect(getFinancialStatementsProvider()).toBe(
            getFinancialStatementsProvider()
        );
    });

    it('singleton is reset between module reloads (vi.resetModules)', async () => {
        const { getFinancialStatementsProvider: get1 } =
            await import('@/shared/api/fmp/getFinancialStatementsProvider');
        vi.resetModules();
        vi.doMock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

        const { getFinancialStatementsProvider: get2 } =
            await import('@/shared/api/fmp/getFinancialStatementsProvider');
        // Different module instances → different singletons (module-level `cached` resets)
        expect(get1()).not.toBe(get2());
    });
});

// NOTE: The E2E branch (`require('./FakeFinancialStatementsProvider')`) is not
// tested here because vitest's ESM runner cannot resolve CJS `require()` relative
// paths. This matches the pattern in getFundamentalDataProvider.test.ts which also
// omits E2E branch coverage for the same reason. The E2E path is exercised by
// Playwright E2E tests that run the full Next.js server with E2E_TEST=1.
