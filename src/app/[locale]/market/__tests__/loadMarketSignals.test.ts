vi.mock('@/entities/market-summary/api/marketSummaryStaticCache', () => ({
    getMarketSummaryStatic: vi.fn(async () => ({ indices: [], sectors: [] })),
}));
vi.mock('@/entities/sector-signal/api/sectorSignalsStaticCache', () => ({
    getSectorSignalsStatic: vi.fn(async () => ({ computedAt: '', stocks: [] })),
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateIfFmpFailedAtBuild: vi.fn(async () => undefined),
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadMarketSignals } from '@/app/[locale]/market/loadMarketSignals';
import { shortenRevalidateIfFmpFailedAtBuild } from '@/shared/cache/buildDegradedRevalidate';
import {
    CRYPTO_DASHBOARD_SCOPE,
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
} from '@/shared/config/dashboardScope';

const mockShorten = vi.mocked(shortenRevalidateIfFmpFailedAtBuild);

/**
 * 빌드 중 FMP가 죽었을 때 60초 degrade revalidate는 FMP 기반 scope에만 걸려야 한다.
 * yahoo인 KRX(`/market/kr`)까지 걸리면 FMP 장애와 무관한 정상 페이지가 매 60초
 * 재생성된다. 헬퍼 내부의 빌드 단계 판정은 헬퍼 자체 테스트가 고정한다 — 여기선 배선만.
 */
describe('loadMarketSignals의 빌드 degrade revalidate 배선', () => {
    beforeEach(() => {
        mockShorten.mockClear();
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        vi.stubEnv('FMP_AT_BUILD', 'off');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it.each([
        ['us', US_DASHBOARD_SCOPE],
        ['crypto', CRYPTO_DASHBOARD_SCOPE],
    ] as const)('FMP scope(%s)는 헬퍼를 부른다', async (_id, scope) => {
        await loadMarketSignals(scope);
        expect(mockShorten).toHaveBeenCalledOnce();
    });

    it('yahoo인 kr scope는 헬퍼를 부르지 않는다', async () => {
        await loadMarketSignals(KR_DASHBOARD_SCOPE);
        expect(mockShorten).not.toHaveBeenCalled();
    });
});
