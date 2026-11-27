const {
    profile,
    assetInfo,
    getCachedBars,
    classify,
    detect,
    spec,
    detectCandlePatternEntries,
    getDetectionBars,
    computeFearGreed,
    evaluateConfluenceSpy,
    findEvents,
    resolveEarnings,
    lookback,
    caveatSpy,
    forming,
} = vi.hoisted(() => ({
    profile: vi.fn(),
    assetInfo: vi.fn(),
    getCachedBars: vi.fn(),
    classify: vi.fn(),
    detect: vi.fn(),
    spec: vi.fn(),
    detectCandlePatternEntries: vi.fn(),
    getDetectionBars: vi.fn(),
    computeFearGreed: vi.fn(),
    evaluateConfluenceSpy: vi.fn(),
    findEvents: vi.fn(),
    resolveEarnings: vi.fn(),
    lookback: vi.fn(),
    caveatSpy: vi.fn(),
    forming: vi.fn(),
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    // 기본은 실제 구현을 태운다 — 표본이 짧으면 core가 기권(null)하는지를 다른
    // 테스트들이 실측 확률 계산으로 검증하기 때문이다. "기권" 자체를 고정하는
    // 테스트에서만 mockReturnValueOnce로 null을 강제한다.
    computeFearGreed.mockImplementation(actual.computeFearGreedIndex);
    // Real implementation, observed only to check which htfBars the tool passes.
    evaluateConfluenceSpy.mockImplementation(actual.evaluateConfluence);
    caveatSpy.mockImplementation(actual.pullbackEventCaveat);
    return {
        ...actual,
        classifyTrend: classify,
        detectSignals: detect,
        detectCandlePatternEntries,
        getDetectionBars,
        computeFearGreedIndex: computeFearGreed,
        evaluateConfluence: evaluateConfluenceSpy,
        pullbackEventCaveat: caveatSpy,
    };
});
vi.mock('next-intl/server', async () => {
    const { catalogTranslator } =
        await import('@/shared/test-utils/catalogTranslator');
    return {
        getTranslations: async ({
            namespace,
            locale,
        }: {
            namespace: string;
            locale: string;
        }) => catalogTranslator(namespace, locale),
    };
});
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: { tag: 'db' } }),
}));
vi.mock('@/entities/news-article/marketEventsRepository', () => ({
    findMarketEventsForPrompt: findEvents,
}));
vi.mock('@/entities/news-article/lib/marketEventsLookback', () => ({
    marketEventsLookback: lookback,
}));
vi.mock('@/entities/earnings-report/api', () => ({
    listEarningsDates: resolveEarnings,
}));
vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: getCachedBars,
}));
vi.mock('@/entities/ticker/server/getAssetInfo', () => ({
    getAssetInfo: assetInfo,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({ sessionSpecFor: spec }));
vi.mock('@/entities/bars/lib/quantizeBars', () => ({
    lastBarIsForming: forming,
}));
vi.mock('@/shared/config/marketProfile/registry', async importOriginal => ({
    ...(await importOriginal<object>()),
    getDescriptor: () => ({ priceFormat: { currency: 'USD' } }),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateIndicators } from '@y0ngha/siglens-core';
import { AGENT_MODEL } from '@/entities/llm-provider/api/agent/router';
import { createToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import { PUBLIC_API_RESULT_CAPS } from '@/shared/config/publicApi';

/**
 * 공개 API(`/api/v1`)가 쓰는 실행기 설정으로 실제 `get_bars_indicators`를 돌린다. 도구가 에이전트 상한이 아니라
 * 호출한 실행기의 상한(`PUBLIC_API_RESULT_CAPS.bars`)에 맞춰 봉을 줄이는지, 그래서 결과가 `{ truncated, preview }`로
 * 무너지지 않는지를 고정한다.
 */

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};

const publicExecutor = () =>
    createToolExecutor(
        { analysisModel: AGENT_MODEL },
        {
            refreshSymbolData: false,
            resultCaps: PUBLIC_API_RESULT_CAPS,
            allowUnofficialSources: false,
            substituteFreshTechnicalForOverall: false,
        }
    );

/** 운영 규모 일봉 500개와 실제 지표 — 기본 요청 크기 측정과 같은 모양. */
function productionSizedSeries() {
    const start = Date.parse('2024-10-21T00:00:00Z') / 1000;
    const bars = Array.from({ length: 500 }, (_, i) => {
        const close =
            Math.round((420 + Math.sin(i / 9) * 35 + i * 0.09) * 100) / 100;
        return {
            time: start + i * 86_400,
            open: Math.round((close - 1.37) * 100) / 100,
            high: Math.round((close + 3.21) * 100) / 100,
            low: Math.round((close - 4.08) * 100) / 100,
            close,
            volume: 1_000_000 + ((i * 7_919) % 2_345_678),
        };
    });
    return {
        bars,
        indicators: {
            ...calculateIndicators(bars),
            buySellVolume: bars.map((b, i) => ({
                buyVolume: b.volume * (0.45 + ((i * 13) % 10) / 100),
                sellVolume: b.volume * (0.45 + ((i * 7) % 10) / 100),
            })),
        },
    };
}

interface BarsResult {
    truncated?: boolean;
    barsReturned: number;
    barsTrimmed: number;
    bars: unknown[];
    latest: { oscillatorSummary: string | null };
}

describe('공개 API의 get_bars_indicators 결과 상한', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        profile.mockResolvedValue('us-equity');
        assetInfo.mockResolvedValue({ symbol: 'AAPL', name: 'Apple' });
        getDetectionBars.mockImplementation((bars: unknown[]) =>
            bars.slice(-15)
        );
        detectCandlePatternEntries.mockReturnValue([]);
        findEvents.mockResolvedValue([]);
        resolveEarnings.mockResolvedValue(undefined);
        lookback.mockReturnValue({ lookbackDays: 60 });
        // 장중 모양(진행 중 표시 + 직전 완료 종가)이 더 크다.
        forming.mockReturnValue(true);
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);
        getCachedBars.mockResolvedValue(productionSizedSeries());
    });

    it('공개 상한은 에이전트 상한 이상이라 기본 요청이 그 안에 들어온다', () => {
        expect(PUBLIC_API_RESULT_CAPS.bars).toBeGreaterThanOrEqual(7_000);
    });

    it('기본 요청(30봉)은 잘리지 않은 온전한 결과이고 봉도 줄지 않는다', async () => {
        const result = (await publicExecutor()(
            'get_bars_indicators',
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx
        )) as BarsResult;
        expect(result.truncated).toBeUndefined();
        expect(result.barsTrimmed).toBe(0);
        expect(result.barsReturned).toBe(30);
        expect(JSON.stringify(result).length).toBeLessThanOrEqual(
            PUBLIC_API_RESULT_CAPS.bars
        );
    });

    it('가장 긴 오실레이터 요약(not available 꼬리 포함)에서도 온전한 결과다', async () => {
        // 다섯 중 CCI만 없고 네 개가 모두 선 바로 아래의 중립 값 → 요약이 가장 긴 꼴(~290자).
        const series = productionSizedSeries();
        const length = series.bars.length;
        const constant = (value: number) => Array.from({ length }, () => value);
        getCachedBars.mockResolvedValue({
            bars: series.bars,
            indicators: {
                ...series.indicators,
                rsi: constant(69.88),
                stochastic: constant(0).map(() => ({
                    percentK: 79.51,
                    percentD: 79,
                })),
                williamsR: constant(-20.49),
                mfi: constant(79.51),
                cci: constant(Number.NaN),
            },
        });
        const result = (await publicExecutor()(
            'get_bars_indicators',
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx
        )) as BarsResult;
        expect(result.latest.oscillatorSummary).toContain('not available: CCI');
        expect(result.latest.oscillatorSummary?.length ?? 0).toBeGreaterThan(
            250
        );
        expect(result.truncated).toBeUndefined();
        expect(result.barsTrimmed).toBe(0);
        expect(JSON.stringify(result).length).toBeLessThanOrEqual(
            PUBLIC_API_RESULT_CAPS.bars
        );
    });

    it('큰 bars 요청은 결과를 자르지 않고 오래된 봉을 줄여 상한 안에 맞춘다', async () => {
        const result = (await publicExecutor()(
            'get_bars_indicators',
            { symbol: 'AAPL', timeframe: '1Day', bars: 200 },
            ctx
        )) as BarsResult;
        expect(result.truncated).toBeUndefined();
        expect(result.barsTrimmed).toBeGreaterThan(0);
        expect(result.barsReturned).toBe(result.bars.length);
        expect(result.barsReturned + result.barsTrimmed).toBe(200);
        expect(JSON.stringify(result).length).toBeLessThanOrEqual(
            PUBLIC_API_RESULT_CAPS.bars
        );
    });

    it('에이전트 실행기는 자기 상한에 맞추고, 더 작은 상한을 주면 그 상한에 맞춘다', async () => {
        const run = async (bars: number) =>
            (await createToolExecutor(
                { analysisModel: AGENT_MODEL },
                {
                    resultCaps: { ...PUBLIC_API_RESULT_CAPS, bars },
                }
            )(
                'get_bars_indicators',
                { symbol: 'AAPL', timeframe: '1Day', bars: 60 },
                ctx
            )) as BarsResult;
        const wide = await run(7_000);
        const narrow = await run(6_200);
        expect(wide.truncated).toBeUndefined();
        expect(narrow.truncated).toBeUndefined();
        expect(narrow.barsReturned).toBeLessThan(wide.barsReturned);
        expect(JSON.stringify(narrow).length).toBeLessThanOrEqual(6_200);
    });
});
