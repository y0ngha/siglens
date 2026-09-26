// vi.mock → imports 순서 (MISTAKES.md Tests §17)
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getMarketNewsClient (prod)', () => {
    afterEach(() => {
        vi.resetModules();
    });

    it('returns an FmpMarketNewsClient instance for fmp-sourced categories', async () => {
        const { getMarketNewsClient } =
            await import('@/entities/market-news/lib/getMarketNewsClient');
        const { FmpMarketNewsClient } =
            await import('@/entities/market-news/lib/fmpMarketNewsClient');
        expect(getMarketNewsClient('general')).toBeInstanceOf(
            FmpMarketNewsClient
        );
    });

    it.each(['general', 'stock', 'crypto', 'forex', 'articles'] as const)(
        'returns the same FMP singleton across %s and other fmp categories',
        async category => {
            const { getMarketNewsClient } =
                await import('@/entities/market-news/lib/getMarketNewsClient');
            expect(getMarketNewsClient(category)).toBe(
                getMarketNewsClient('general')
            );
        }
    );

    it('routes the kr category to a NaverMarketNewsClient instance', async () => {
        const { getMarketNewsClient } =
            await import('@/entities/market-news/lib/getMarketNewsClient');
        const { NaverMarketNewsClient } =
            await import('@/entities/market-news/lib/naverMarketNewsClient');
        expect(getMarketNewsClient('kr')).toBeInstanceOf(NaverMarketNewsClient);
    });

    it('the kr client is a different instance than the fmp client', async () => {
        const { getMarketNewsClient } =
            await import('@/entities/market-news/lib/getMarketNewsClient');
        expect(getMarketNewsClient('kr')).not.toBe(
            getMarketNewsClient('general')
        );
    });

    it('returns the same kr singleton across calls', async () => {
        const { getMarketNewsClient } =
            await import('@/entities/market-news/lib/getMarketNewsClient');
        expect(getMarketNewsClient('kr')).toBe(getMarketNewsClient('kr'));
    });

    it('singleton is reset between module reloads (vi.resetModules)', async () => {
        const { getMarketNewsClient: get1 } =
            await import('@/entities/market-news/lib/getMarketNewsClient');
        vi.resetModules();
        vi.doMock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

        const { getMarketNewsClient: get2 } =
            await import('@/entities/market-news/lib/getMarketNewsClient');
        // Different module instances → different singletons (module-level `cached*` resets)
        expect(get1('general')).not.toBe(get2('general'));
    });
});

// NOTE: The E2E branch (`require('./FakeMarketNewsClient')`) is not tested here
// because vitest's ESM runner cannot resolve CJS `require()` relative paths
// (same constraint as getCongressTradesProvider.test.ts / getFundamentalDataProvider.test.ts).
// The E2E path is exercised by Playwright E2E tests that run the full Next.js server
// with E2E_TEST=1.
