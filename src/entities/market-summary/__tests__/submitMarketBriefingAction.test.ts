import type { MockedFunction } from 'vitest';
import { submitMarketBriefingAction } from '../actions/submitMarketBriefingAction';
import {
    peekBriefingCache,
    runBriefing,
    type MarketSummaryData,
    type RunBriefingResult,
} from '@y0ngha/siglens-core';
import { headers } from 'next/headers';
import { getCachedMarketSummary } from '../api/marketSummaryCache';
import {
    releaseMarketBriefingSlot,
    tryAcquireMarketBriefingSlot,
} from '../api/marketBriefingCooldown';
import {
    readLatestMarketBriefing,
    writeLatestMarketBriefing,
} from '../api/latestMarketBriefing';
import { readHubSsrSeed, writeHubSsrSeed } from '@/shared/cache/hubSsrSeed';
import {
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
} from '@/shared/config/dashboardScope';

vi.mock('server-only', () => ({}));

vi.mock('../api/marketSummaryCache', () => ({
    getCachedMarketSummary: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    peekBriefingCache: vi.fn(),
    runBriefing: vi.fn(),
}));

vi.mock('../api/marketBriefingCooldown', () => ({
    tryAcquireMarketBriefingSlot: vi.fn(),
    releaseMarketBriefingSlot: vi.fn(),
}));

vi.mock('../api/latestMarketBriefing', () => ({
    readLatestMarketBriefing: vi.fn(),
    writeLatestMarketBriefing: vi.fn(),
}));

vi.mock('@/shared/cache/hubSsrSeed', () => ({
    readHubSsrSeed: vi.fn(),
    writeHubSsrSeed: vi.fn(),
}));

vi.mock('next/headers', () => ({
    headers: vi.fn().mockResolvedValue(new Headers()),
}));

const mockProvider = {} as import('@y0ngha/siglens-core').MarketDataProvider;
vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    getMarketDataProvider: vi.fn(() => mockProvider),
    // scope 인지 팩토리도 같은 모듈에 있다 — 목에서 빠지면 액션이 import 단계에서
    // 실패해 `server_error`로 조용히 떨어진다.
    marketDataProviderFor: vi.fn(() => mockProvider),
}));

const mockGetCachedMarketSummary = getCachedMarketSummary as MockedFunction<
    typeof getCachedMarketSummary
>;
const mockRunBriefing = runBriefing as MockedFunction<typeof runBriefing>;
const mockPeekBriefingCache = peekBriefingCache as MockedFunction<
    typeof peekBriefingCache
>;
const mockTryAcquire = tryAcquireMarketBriefingSlot as MockedFunction<
    typeof tryAcquireMarketBriefingSlot
>;
const mockRelease = releaseMarketBriefingSlot as MockedFunction<
    typeof releaseMarketBriefingSlot
>;
const mockReadLatest = readLatestMarketBriefing as MockedFunction<
    typeof readLatestMarketBriefing
>;
const mockWriteLatest = writeLatestMarketBriefing as MockedFunction<
    typeof writeLatestMarketBriefing
>;
const mockReadSeed = readHubSsrSeed as MockedFunction<typeof readHubSsrSeed>;
const mockWriteSeed = writeHubSsrSeed as MockedFunction<typeof writeHubSsrSeed>;
const mockHeaders = headers as MockedFunction<typeof headers>;

const summaryData: MarketSummaryData = {
    indices: [
        {
            symbol: 'SPY',
            fmpSymbol: '^GSPC',
            displayName: 'S&P 500',
            koreanName: 'S&P 500',
            price: 5000,
            changesPercentage: 0.5,
        },
        // VIX를 픽스처에 둔다 — 없으면 context가 `volatility: null`이라
        // 쓰기·읽기 두 경로가 같은 값을 만드는지가 자명한 값에서만 고정된다.
        {
            symbol: 'VIX',
            fmpSymbol: '^VIX',
            displayName: 'VIX',
            koreanName: '공포지수',
            price: 18.3,
            changesPercentage: -2.1,
        },
    ],
    sectors: [
        {
            symbol: 'XLK',
            sectorName: 'Technology',
            koreanName: '기술',
            price: 200,
            changesPercentage: 1.2,
        },
    ],
};

const briefingResult: RunBriefingResult = {
    status: 'done',
    briefing: { summary: 'test-briefing' } as never,
    generatedAt: '2025-01-01T00:00:00Z',
};

describe('submitMarketBriefingAction 함수는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCachedMarketSummary.mockResolvedValue(summaryData);
        // 기본은 "캐시 miss + 슬롯 획득" — 생성 경로. 쿨다운 분기는 아래 describe에서 바꾼다.
        mockPeekBriefingCache.mockResolvedValue(null);
        mockTryAcquire.mockResolvedValue(true);
        mockReadLatest.mockResolvedValue(null);
        mockReadSeed.mockResolvedValue(null);
    });

    describe('일반 요청 시', () => {
        beforeEach(() => {
            mockRunBriefing.mockResolvedValue(briefingResult);
        });

        it('(Happy) runBriefing 결과를 scope와 함께 반환한다', async () => {
            const result = await submitMarketBriefingAction('us');

            expect(result).toEqual({
                briefing: briefingResult,
                scope: 'us',
            });
        });

        it('(Happy) getCachedMarketSummary와 runBriefing(summary, context)를 호출한다', async () => {
            await submitMarketBriefingAction('us');

            expect(mockGetCachedMarketSummary).toHaveBeenCalledWith(
                mockProvider,
                US_DASHBOARD_SCOPE
            );
            // context는 core 캐시 키에 접힌다 — peek 경로(peekBriefingStatic)와
            // 같은 헬퍼로 조립되지 않으면 두 키가 갈려 peek이 영원히 미스한다.
            expect(mockRunBriefing).toHaveBeenCalledWith(
                summaryData,
                {
                    marketLabel: 'US market',
                    volatility: { label: 'VIX', level: 18.3 },
                },
                { signal: undefined }
            );
        });
    });

    // UA로 가르지 않는다 — Googlebot 렌더가 `/market`에서 브리핑 대신 차단
    // 안내문을 색인하던 회귀를 막는다(2026-09-17 운영 렌더 감사).
    describe('봇 요청 시', () => {
        beforeEach(() => {
            // `isBot`은 목하지 않는다 — 진짜 판정기에 Googlebot UA를 넘겨, 누가 UA
            // 분기를 되살리면 이 테스트가 실패하게 한다.
            mockHeaders.mockResolvedValueOnce(
                new Headers({
                    'user-agent':
                        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                }) as never
            );
            mockRunBriefing.mockResolvedValue(briefingResult);
        });

        it('(Happy) 사람과 같은 브리핑 결과를 반환한다', async () => {
            const result = await submitMarketBriefingAction('us');

            expect(result).toEqual({ briefing: briefingResult, scope: 'us' });
            expect(mockRunBriefing).toHaveBeenCalledTimes(1);
        });
    });

    describe('에러 발생 시', () => {
        it('(Worst) runBriefing이 throw하면 에러 결과를 반환한다', async () => {
            mockRunBriefing.mockRejectedValueOnce(new Error('briefing failed'));

            const result = await submitMarketBriefingAction('us');

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });

        it('(Worst) getCachedMarketSummary throw 시 에러 결과를 반환한다', async () => {
            mockGetCachedMarketSummary.mockRejectedValueOnce(
                new Error('redis down')
            );

            const result = await submitMarketBriefingAction('us');

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });
    });

    describe('scope 배선', () => {
        it("'kr'이면 KR 요약으로 브리핑을 만들고 응답에 scope를 실어 준다", async () => {
            mockRunBriefing.mockResolvedValue(briefingResult);
            mockGetCachedMarketSummary.mockResolvedValue(summaryData);

            const result = await submitMarketBriefingAction('kr');

            expect(mockGetCachedMarketSummary).toHaveBeenCalledWith(
                expect.anything(),
                KR_DASHBOARD_SCOPE
            );
            // 픽스처에는 VIX가 들어 있다 — `volatilityIndexSymbol: null`인 시장이
            // 그걸 **무시하는지**가 이 단언의 요점이다. VIX가 새어 들어가면 KR
            // 캐시 키가 쓰기·읽기 사이에서 갈린다.
            expect(mockRunBriefing).toHaveBeenCalledWith(
                summaryData,
                { marketLabel: 'Korean market', volatility: null },
                { signal: undefined }
            );
            expect(result).toEqual({
                briefing: briefingResult,
                scope: 'kr',
            });
        });

        it('알 수 없는 scope는 요약을 읽지 않고 server_error를 반환한다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockGetCachedMarketSummary.mockClear();

            const result = await submitMarketBriefingAction('jp');

            expect(result).toEqual({ ok: false, error: 'server_error' });
            expect(mockGetCachedMarketSummary).not.toHaveBeenCalled();
            errSpy.mockRestore();
        });

        it("'crypto'는 isDashboardScopeId는 통과하지만 hasHubPage가 false라 요약을 읽지 않고 server_error를 반환한다", async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockGetCachedMarketSummary.mockClear();

            const result = await submitMarketBriefingAction('crypto');

            expect(result).toEqual({ ok: false, error: 'server_error' });
            expect(mockGetCachedMarketSummary).not.toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });
    /**
     * 생성 쿨다운(2026-10 비용 감사). core 키가 시세 해시를 담아 장중엔 요약 갱신마다
     * 갈리므로, 키 miss마다 생성하던 때는 방문자가 거의 매분 LLM을 불렀다.
     */
    describe('생성 쿨다운', () => {
        const cachedResult: RunBriefingResult = {
            status: 'cached',
            briefing: { summary: 'cached-briefing' } as never,
            generatedAt: '2025-01-01T00:00:00Z',
        };
        const latest = {
            briefing: { summary: 'latest-briefing' } as never,
            generatedAt: '2025-01-01T01:00:00Z',
        };

        it('캐시 hit이면 슬롯을 잡지 않고 runBriefing의 cached 결과를 반환한다', async () => {
            mockPeekBriefingCache.mockResolvedValue(cachedResult.briefing);
            mockRunBriefing.mockResolvedValue(cachedResult);

            const result = await submitMarketBriefingAction('us');

            expect(result).toEqual({ briefing: cachedResult, scope: 'us' });
            expect(mockTryAcquire).not.toHaveBeenCalled();
            expect(mockWriteLatest).not.toHaveBeenCalled();
        });

        it('miss + 슬롯 획득이면 생성하고 마지막 생성본과 SSR seed를 쓴다', async () => {
            mockRunBriefing.mockResolvedValue(briefingResult);

            const result = await submitMarketBriefingAction('kr');

            expect(mockTryAcquire).toHaveBeenCalledWith('kr');
            expect(mockRunBriefing).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ briefing: briefingResult, scope: 'kr' });
            expect(mockWriteLatest).toHaveBeenCalledWith(KR_DASHBOARD_SCOPE, {
                briefing: briefingResult.briefing,
                generatedAt: briefingResult.generatedAt,
            });
            expect(mockWriteSeed).toHaveBeenCalledWith(
                'market-briefing:kr',
                briefingResult.briefing
            );
            expect(mockRelease).not.toHaveBeenCalled();
        });

        it('miss + 슬롯을 못 잡으면 runBriefing 없이 마지막 생성본을 cached로 돌려준다', async () => {
            mockTryAcquire.mockResolvedValue(false);
            mockReadLatest.mockResolvedValue(latest);

            const result = await submitMarketBriefingAction('us');

            expect(mockRunBriefing).not.toHaveBeenCalled();
            expect(mockReadLatest).toHaveBeenCalledWith(US_DASHBOARD_SCOPE);
            expect(result).toEqual({
                briefing: { status: 'cached', ...latest },
                scope: 'us',
            });
        });

        it('마지막 생성본이 없으면 SSR seed를 시각 없이(빈 generatedAt) 돌려준다', async () => {
            mockTryAcquire.mockResolvedValue(false);
            mockReadSeed.mockResolvedValue({ summary: 'seed-briefing' });

            const result = await submitMarketBriefingAction('us');

            expect(mockRunBriefing).not.toHaveBeenCalled();
            expect(mockReadSeed).toHaveBeenCalledWith('market-briefing:us');
            expect(result).toEqual({
                briefing: {
                    status: 'cached',
                    briefing: { summary: 'seed-briefing' },
                    generatedAt: '',
                },
                scope: 'us',
            });
        });

        it('돌려줄 브리핑이 아예 없으면(콜드 스타트) 슬롯 없이 생성한다', async () => {
            mockTryAcquire.mockResolvedValue(false);
            mockRunBriefing.mockResolvedValue(briefingResult);

            const result = await submitMarketBriefingAction('us');

            expect(mockRunBriefing).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ briefing: briefingResult, scope: 'us' });
            expect(mockWriteLatest).toHaveBeenCalled();
        });

        it('슬롯을 잡은 생성이 실패하면 슬롯을 돌려주고 server_error를 반환한다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockRunBriefing.mockRejectedValueOnce(new Error('llm down'));

            const result = await submitMarketBriefingAction('us');

            expect(result).toEqual({ ok: false, error: 'server_error' });
            expect(mockRelease).toHaveBeenCalledWith('us');
            expect(mockWriteLatest).not.toHaveBeenCalled();
            errSpy.mockRestore();
        });

        it('남이 잡은 슬롯(콜드 스타트 생성)은 실패해도 돌려주지 않는다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockTryAcquire.mockResolvedValue(false);
            mockRunBriefing.mockRejectedValueOnce(new Error('llm down'));

            const result = await submitMarketBriefingAction('us');

            expect(result).toEqual({ ok: false, error: 'server_error' });
            expect(mockRelease).not.toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });
});
