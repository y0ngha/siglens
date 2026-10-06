// vi.mock → imports 순서 (MISTAKES.md Tests §17)
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MODULE_LOAD_TIMEOUT_MS } from '@/shared/test-utils/testTimeouts';

describe('getCongressTradesProvider (prod)', () => {
    // 첫 케이스가 콜드 적재(변환 + 외부 의존 로드)를 본문에서 치르지 않게 미리 받는다.
    // 첫 케이스는 이 레지스트리를 그대로 쓰고, 이후 리셋 뒤 재평가는 변환 결과를 재사용한다.
    beforeAll(async () => {
        await Promise.all([
            import('@/shared/api/fmp/getCongressTradesProvider'),
            import('@/shared/api/fmp/CachedCongressTradesProvider'),
        ]);
    }, MODULE_LOAD_TIMEOUT_MS);

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
