import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MODULE_LOAD_TIMEOUT_MS } from '@/shared/test-utils/testTimeouts';

vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

describe('getFinancialStatementsProvider (prod)', () => {
    // 첫 케이스가 콜드 적재(변환 + 외부 의존 로드)를 본문에서 치르지 않게 미리 받는다.
    // 첫 케이스는 이 레지스트리를 그대로 쓰고, 이후 리셋 뒤 재평가는 변환 결과를 재사용한다.
    beforeAll(async () => {
        await Promise.all([
            import('@/shared/api/fmp/getFinancialStatementsProvider'),
            import('@/shared/api/fmp/CachedFinancialStatementsProvider'),
        ]);
    }, MODULE_LOAD_TIMEOUT_MS);

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

    it.each(['AAPL', 'BTCUSD'])('keeps the FMP path for %s', async symbol => {
        const { getFinancialStatementsProvider } =
            await import('@/shared/api/fmp/getFinancialStatementsProvider');
        expect(getFinancialStatementsProvider(symbol)).toBe(
            getFinancialStatementsProvider()
        );
    });

    it('routes Korean symbols to a different provider than FMP', async () => {
        // FMP 플랜이 KRX를 커버하지 않아 yahoo 백엔드로 가야 한다.
        const { getFinancialStatementsProvider } =
            await import('@/shared/api/fmp/getFinancialStatementsProvider');
        expect(getFinancialStatementsProvider('005930.KS')).not.toBe(
            getFinancialStatementsProvider('AAPL')
        );
    });

    it('returns the same KR singleton across Korean symbols', async () => {
        const { getFinancialStatementsProvider } =
            await import('@/shared/api/fmp/getFinancialStatementsProvider');
        expect(getFinancialStatementsProvider('247540.KQ')).toBe(
            getFinancialStatementsProvider('005930.KS')
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
