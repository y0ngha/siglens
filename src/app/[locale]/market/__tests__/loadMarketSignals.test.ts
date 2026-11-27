vi.mock('@/entities/market-summary/api/marketSummaryStaticCache', () => ({
    getMarketSummaryStatic: vi.fn(async () => ({ indices: [], sectors: [] })),
}));
vi.mock('@/entities/sector-signal/api/sectorSignalsStaticCache', () => ({
    getSectorSignalsStatic: vi.fn(async () => ({ computedAt: '', stocks: [] })),
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateIfFmpFailedAtBuild: vi.fn(async () => undefined),
    shortenRevalidateForRuntimeDegrade: vi.fn(async () => undefined),
    flagNoindexDegradedRender: vi.fn(async () => undefined),
}));

import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
    afterAll,
} from 'vitest';
import { loadMarketSignals } from '@/app/[locale]/market/loadMarketSignals';
import { getMarketSummaryStatic } from '@/entities/market-summary/api/marketSummaryStaticCache';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import {
    flagNoindexDegradedRender,
    shortenRevalidateForRuntimeDegrade,
    shortenRevalidateIfFmpFailedAtBuild,
} from '@/shared/cache/buildDegradedRevalidate';
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

describe('loadMarketSignals의 시세 결측 판정', () => {
    const quote = (price: number) => ({
        symbol: 'EWY',
        sectorName: 'x',
        koreanName: 'x',
        price,
        changesPercentage: 0,
    });
    const index = (price: number) => ({
        symbol: 'KS11',
        fmpSymbol: '^KS11',
        displayName: 'KOSPI',
        koreanName: '코스피',
        price,
        changesPercentage: 0,
    });
    const mockSummary = vi.mocked(getMarketSummaryStatic);
    const mockSectors = vi.mocked(getSectorSignalsStatic);
    const mockRuntime = vi.mocked(shortenRevalidateForRuntimeDegrade);
    const mockNoindex = vi.mocked(flagNoindexDegradedRender);
    const errorSpy = vi.spyOn(console, 'error');

    beforeEach(() => {
        mockRuntime.mockClear();
        mockNoindex.mockClear();
        errorSpy.mockReset();
        errorSpy.mockImplementation(() => {});
    });

    afterEach(() => {
        mockSummary.mockReset();
        mockSummary.mockResolvedValue({ indices: [], sectors: [] });
        mockSectors.mockReset();
        mockSectors.mockResolvedValue({ computedAt: '', stocks: [] });
    });

    afterAll(() => {
        errorSpy.mockRestore();
    });

    describe('kr scope의 지수 시세가 0일 때', () => {
        it('같은 1시간 번들을 다시 읽을 뿐이라 핀도 [market:] 로그도 없다', async () => {
            mockSummary.mockResolvedValue({
                indices: [index(0)],
                sectors: [quote(100)],
            });

            await loadMarketSignals(KR_DASHBOARD_SCOPE);

            expect(mockRuntime).not.toHaveBeenCalled();
            expect(errorSpy).not.toHaveBeenCalled();
        });
    });

    describe('kr scope의 섹터 ETF만 0일 때', () => {
        it('일상 결측이라 핀도 로그도 없다', async () => {
            mockSummary.mockResolvedValue({
                indices: [index(100)],
                sectors: [quote(0)],
            });

            await loadMarketSignals(KR_DASHBOARD_SCOPE);

            expect(mockRuntime).not.toHaveBeenCalled();
            expect(errorSpy).not.toHaveBeenCalled();
        });
    });

    describe('us scope의 지수 시세가 0일 때', () => {
        it('핀도 [market:] 로그도 없다', async () => {
            mockSummary.mockResolvedValue({
                indices: [index(0)],
                sectors: [quote(100)],
            });

            await loadMarketSignals(US_DASHBOARD_SCOPE);

            expect(mockRuntime).not.toHaveBeenCalled();
            expect(errorSpy).not.toHaveBeenCalled();
        });
    });

    describe('요약 로더가 던졌을 때', () => {
        it('섹터 데이터가 남아 있으면 degraded는 아니지만 300초 핀은 건다', async () => {
            mockSummary.mockRejectedValue(
                new Error('[market:kr] summary quotes all missing')
            );
            mockSectors.mockResolvedValue({
                computedAt: 'x',
                stocks: [{ symbol: 'A' }] as never,
            });

            const result = await loadMarketSignals(KR_DASHBOARD_SCOPE);

            expect(result.degraded).toBe(false);
            expect(result.summary).toEqual({ indices: [], sectors: [] });
            expect(mockRuntime).toHaveBeenCalledOnce();
            expect(mockNoindex).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalledWith(
                '[loadMarketSignals:kr] getMarketSummaryStatic failed:',
                expect.anything()
            );
        });

        it('섹터 데이터까지 비면 degraded이고 noindex 표식도 붙는다', async () => {
            mockSummary.mockRejectedValue(new Error('outage'));

            const result = await loadMarketSignals(KR_DASHBOARD_SCOPE);

            expect(result.degraded).toBe(true);
            expect(mockRuntime).toHaveBeenCalledOnce();
            expect(mockNoindex).toHaveBeenCalledOnce();
        });
    });

    describe('정상 시세일 때', () => {
        it('핀도 로그도 없다', async () => {
            mockSummary.mockResolvedValue({
                indices: [index(100)],
                sectors: [quote(100)],
            });

            await loadMarketSignals(KR_DASHBOARD_SCOPE);

            expect(mockRuntime).not.toHaveBeenCalled();
            expect(mockNoindex).not.toHaveBeenCalled();
            expect(errorSpy).not.toHaveBeenCalled();
        });
    });
});
