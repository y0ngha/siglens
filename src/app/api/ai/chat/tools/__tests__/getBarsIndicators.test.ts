import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BARS_RESULT_MAX_CHARS,
    TOOL_RESULT_MAX_CHARS,
    truncateToolResult,
} from '@/app/api/ai/chat/tools/truncate';

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
vi.mock('@/entities/bars/lib/barsDataCache', () => ({
    getCachedBarsWithIndicators: getCachedBars,
}));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: assetInfo,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({ sessionSpecFor: spec }));
vi.mock('@/shared/config/marketProfile/registry', () => ({
    getDescriptor: () => ({ priceFormat: { currency: 'USD' } }),
}));

import {
    aggregateBarsToWeekly,
    calculateIndicators,
    calculateMA,
    CONFLUENCE_MIN_BARS,
    CONFLUENCE_TREND_MA_PERIOD,
    evaluateConfluence,
    PULLBACK_BASE_RATES,
    scoreConfluence,
} from '@y0ngha/siglens-core';
import {
    buildFearGreedHistoryView,
    getBarsIndicatorsTool,
    MA50_PERIOD,
} from '@/app/api/ai/chat/tools/getBarsIndicators';
import {
    buildFearGreedPeriodComparisonLine,
    buildFearGreedYearRangeLine,
} from '@/views/symbol/fearGreed/utils/fearGreedFacts';
import { scoredHistory } from '@/entities/bars/lib/fearGreedWindow';
import { pctVs } from '@/app/api/ai/chat/tools/percent';
import { roundNumber } from '@/entities/bars/lib/roundIndicators';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};

const bar = (time: number, close: number) => ({
    time,
    open: close,
    high: close,
    low: close,
    close,
    volume: 100,
});
const indicators = {
    rsi: [1, 2],
    macd: [],
    bollinger: [],
    atr: [null, 3],
    ma: { 20: [1, 2] },
    ema: { 20: [1, 2] },
    dmi: [{ adx: 20, diPlus: 25, diMinus: 15 }],
    stochastic: [{ percentK: 60, percentD: 55 }],
    cci: [42],
    mfi: [50],
    williamsR: [-30],
    vwap: [101],
    ichimoku: [{ tenkan: 1, kijun: 2, senkouA: 3, senkouB: 4, chikou: 5 }],
    supertrend: [{ supertrend: 99, trend: 'up' }],
    parabolicSar: [{ sar: 98, trend: 'up' }],
    squeezeMomentum: [
        { momentum: 1.2, sqzOn: true, sqzOff: false, noSqz: false },
    ],
};

describe('getBarsIndicatorsTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        assetInfo.mockResolvedValue({ symbol: 'AAPL', name: 'Apple' });
        getDetectionBars.mockImplementation((bars: unknown[]) =>
            bars.slice(-15)
        );
        detectCandlePatternEntries.mockReturnValue([]);
        findEvents.mockResolvedValue([]);
        resolveEarnings.mockResolvedValue(undefined);
        lookback.mockReturnValue({ lookbackDays: 60 });
    });

    it('1Day에서는 종목 자체 공포·탐욕 지수를 함께 내고, 다른 타임프레임·짧은 흐름 데이터에서는 null', async () => {
        profile.mockResolvedValue('us-equity');
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);
        // 워크포워드 표본을 채우려면 긴 일봉이 필요하다 — 실제 core 함수를 그대로 태운다.
        // `bar()` 헬퍼는 고가=저가=종가·거래량 고정이라 변동성·거래량 백분위가
        // 서지 않는다 — 공포·탐욕은 그 표본으로는 기권(null)한다.
        const longBars = Array.from({ length: 400 }, (_, i) => {
            const close = 100 + Math.sin(i / 7) * 12 + i * 0.05;
            return {
                time: i * 86_400,
                open: close - 0.5,
                high: close + 1,
                low: close - 1,
                close,
                volume: 100 + ((i * 37) % 50),
            };
        });
        const withFlow = {
            ...indicators,
            buySellVolume: longBars.map((_, i) => ({
                buyVolume: 60 + ((i * 13) % 20),
                sellVolume: 40 + ((i * 7) % 20),
            })),
        };
        getCachedBars.mockResolvedValue({
            bars: longBars,
            indicators: withFlow,
        });
        const daily = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx,
            rt
        )) as { fearGreed: { score: number; groups: unknown[] } | null };
        expect(daily.fearGreed).not.toBeNull();
        expect(daily.fearGreed?.score).toBeGreaterThanOrEqual(0);
        expect(daily.fearGreed?.score).toBeLessThanOrEqual(100);
        expect(daily.fearGreed?.groups.length).toBeGreaterThan(0);

        // 화면(`/{symbol}/fear-greed`)이 일봉에 고정돼 있다 — 다른 봉으로 계산하면
        // 어느 화면에도 없는 점수를 내놓게 된다.
        const intraday = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '4Hour' },
            ctx,
            rt
        )) as { fearGreed: unknown };
        expect(intraday.fearGreed).toBeNull();

        // 흐름 배열이 봉보다 짧으면 core가 인덱스로 읽다 throw한다.
        getCachedBars.mockResolvedValue({
            bars: longBars,
            indicators: { ...indicators, buySellVolume: [] },
        });
        const shortFlow = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx,
            rt
        )) as { fearGreed: unknown; trend: string };
        expect(shortFlow.fearGreed).toBeNull();
        expect(shortFlow.trend).toBe('uptrend');
    });

    /**
     * 모델이 말하는 점수는 화면과 같은 5년 일봉으로 계산해야 한다. 캐시된 일봉에
     * `fearGreedBars`가 있으면 그 배열을 core에 넘기는지 고정한다 — 표준 봉으로
     * 되돌아가면 이 테스트가 깨진다.
     */
    it('일봉에 5년 시계열(fearGreedBars)이 있으면 그 봉으로 공포·탐욕을 계산한다', async () => {
        profile.mockResolvedValue('us-equity');
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);
        const stdBars = Array.from({ length: 30 }, (_, i) => ({
            time: 1_700_000_000 + (i + 50) * 86_400,
            open: 100,
            high: 101,
            low: 99,
            close: 100,
            volume: 1_000,
        }));
        const longBars = Array.from({ length: 80 }, (_, i) => ({
            ...stdBars[0]!,
            time: 1_700_000_000 + i * 86_400,
        }));
        getCachedBars.mockResolvedValue({
            bars: stdBars,
            indicators: {
                ...indicators,
                buySellVolume: stdBars.map(() => ({
                    buyVolume: 500,
                    sellVolume: 500,
                })),
            },
            fearGreedBars: longBars,
        });

        await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx,
            rt
        );

        const call = computeFearGreed.mock.calls.find(
            ([bars]) => (bars as unknown[]).length === longBars.length
        );
        expect(call).toBeDefined();
        expect(call![0]).toEqual(longBars);
        expect((call![1] as unknown[]).length).toBe(longBars.length);
    });

    it('core가 표본 부족으로 기권(null)하면 fearGreed만 null이고 나머지 페이로드는 그대로 나간다', async () => {
        profile.mockResolvedValue('us-equity');
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);
        computeFearGreed.mockReturnValueOnce(null);
        const longBars = Array.from({ length: 400 }, (_, i) => ({
            time: i * 86_400,
            open: 100,
            high: 101,
            low: 99,
            close: 100,
            volume: 100,
        }));
        getCachedBars.mockResolvedValue({
            bars: longBars,
            indicators: {
                ...indicators,
                buySellVolume: longBars.map(() => ({
                    buyVolume: 60,
                    sellVolume: 40,
                })),
            },
        });
        const r = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx,
            rt
        )) as { fearGreed: unknown; trend: string };
        expect(r.fearGreed).toBeNull();
        expect(r.trend).toBe('uptrend');
    });

    it('봉이 없으면 found:false', async () => {
        profile.mockResolvedValue('us-equity');
        getCachedBars.mockResolvedValue({ bars: [], indicators });
        const r = await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx,
            rt
        );
        expect(r).toEqual({ symbol: 'AAPL', timeframe: '1Day', found: false });
    });

    it('N봉 절단 + trend/signals 포함, fmpSymbol이 캐시 조회에 전달된다', async () => {
        profile.mockResolvedValue('us-equity');
        assetInfo.mockResolvedValue({ symbol: 'BRK.A', fmpSymbol: 'BRK-A' });
        const bars = Array.from({ length: 50 }, (_, i) =>
            bar(1_700_000_000 + i * 86_400, 100 + i)
        );
        getCachedBars.mockResolvedValue({ bars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([
            {
                type: 'golden_cross',
                direction: 'bullish',
                phase: 'confirmed',
                detectedAt: 0,
            },
        ]);

        const r = (await getBarsIndicatorsTool(
            { symbol: 'BRK.A', timeframe: '1Day', bars: 10 },
            ctx,
            rt
        )) as {
            bars: unknown[];
            trend: string;
            signals: Array<{ type: string }>;
            latest: { rsi: number | null; rsiZone: string | null };
        };
        expect(r.bars).toHaveLength(10);
        expect(r.trend).toBe('uptrend');
        expect(r.signals).toEqual([
            { type: 'golden_cross', direction: 'bullish', phase: 'confirmed' },
        ]);
        expect(r.latest.rsi).toBe(2);
        // 차트 탭·분석 프롬프트와 같은 core 구간 판정(≤ 30 → oversold)을 싣는다.
        expect(r.latest.rsiZone).toBe('oversold');
        expect(getCachedBars).toHaveBeenCalledWith(
            {},
            'BRK.A',
            '1Day',
            'BRK-A',
            undefined
        );
    });

    it.each([
        // NVDA 보고 사례: 37.5는 차트 탭과 같이 neutral이어야 한다.
        { rsi: [40, 37.5], zone: 'neutral' },
        { rsi: [60, 70], zone: 'overbought' },
        // RSI가 없거나 유한하지 않으면 구간을 지어내지 않는다.
        { rsi: [50, null], zone: null },
        { rsi: [50, Number.NaN], zone: null },
    ])('latest.rsiZone은 마지막 RSI $rsi → $zone', async ({ rsi, zone }) => {
        profile.mockResolvedValue('us-equity');
        const bars = Array.from({ length: 50 }, (_, i) =>
            bar(1_700_000_000 + i * 86_400, 100 + i)
        );
        getCachedBars.mockResolvedValue({
            bars,
            indicators: { ...indicators, rsi },
        });
        const r = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day', bars: 10 },
            ctx,
            rt
        )) as { latest: { rsiZone: string | null } };
        expect(r.latest.rsiZone).toBe(zone);
    });

    it('getAssetInfo가 throw해도 fmpSymbol 없이 진행된다', async () => {
        profile.mockResolvedValue('us-equity');
        assetInfo.mockRejectedValue(new Error('db down'));
        const bars = [bar(1_700_000_000, 100)];
        getCachedBars.mockResolvedValue({ bars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);

        const r = await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx,
            rt
        );
        expect(r).toMatchObject({ symbol: 'AAPL' });
        expect(getCachedBars).toHaveBeenCalledWith(
            {},
            'AAPL',
            '1Day',
            undefined,
            undefined
        );
    });

    it('latest는 dmi/stochastic/cci/mfi/williamsR/vwap/ichimoku/supertrend/parabolicSar/squeezeMomentum을 압축 형태로 포함한다', async () => {
        profile.mockResolvedValue('us-equity');
        const bars = [bar(1_700_000_000, 100), bar(1_700_086_400, 101)];
        getCachedBars.mockResolvedValue({ bars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);

        const r = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx,
            rt
        )) as { latest: Record<string, unknown> };

        expect(r.latest.dmi).toEqual({ adx: 20, diPlus: 25, diMinus: 15 });
        expect(r.latest.stochastic).toEqual({ percentK: 60, percentD: 55 });
        expect(r.latest.cci).toBe(42);
        expect(r.latest.mfi).toBe(50);
        expect(r.latest.williamsR).toBe(-30);
        expect(r.latest.vwap).toBe(101);
        expect(r.latest.ichimoku).toEqual({
            tenkan: 1,
            kijun: 2,
            senkouA: 3,
            senkouB: 4,
        });
        expect(r.latest.supertrend).toEqual({ value: 99, trend: 'up' });
        expect(r.latest.parabolicSar).toEqual({ sar: 98, trend: 'up' });
        expect(r.latest.squeezeMomentum).toEqual({
            momentum: 1.2,
            sqzOn: true,
        });
    });

    it('missing/empty 배열은 null로 tolerate된다', async () => {
        profile.mockResolvedValue('us-equity');
        const bars = [bar(1_700_000_000, 100)];
        getCachedBars.mockResolvedValue({
            bars,
            indicators: { ...indicators, dmi: [], supertrend: [] },
        });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);

        const r = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx,
            rt
        )) as { latest: Record<string, unknown> };
        expect(r.latest.dmi).toBeNull();
        expect(r.latest.supertrend).toBeNull();
    });

    it('candlePatterns: selectLastCandlePatternEntries와 같은 선택(최신 multi + 최신 single)만 남기고 날짜를 detection window 기준으로 매핑한다', async () => {
        profile.mockResolvedValue('us-equity');
        const bars = Array.from({ length: 20 }, (_, i) =>
            bar(1_700_000_000 + i * 86_400, 100 + i)
        );
        getCachedBars.mockResolvedValue({ bars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);
        // Several detected entries, mixing single/multi at various
        // barIndex values — only the freshest multi (barIndex 6) and the
        // freshest single (barIndex 5) should survive, exactly what
        // `selectLastCandlePatternEntries` (also used by the chart markers
        // in `useCandlePatternMarkers.ts` and the analysis prompt) selects.
        // `selectLastCandlePatternEntries` isn't mocked here — the module
        // mock only overrides `detectCandlePatternEntries`/`getDetectionBars`
        // and spreads `...actual` for everything else, so this exercises
        // core's real selection logic against the mocked entries.
        detectCandlePatternEntries.mockReturnValue([
            {
                barIndex: 0,
                patternType: 'single',
                singlePattern: 'pattern_0',
                multiPattern: null,
            },
            {
                barIndex: 1,
                patternType: 'multi',
                singlePattern: null,
                multiPattern: 'multi_1',
            },
            {
                barIndex: 2,
                patternType: 'single',
                singlePattern: 'pattern_2',
                multiPattern: null,
            },
            {
                barIndex: 3,
                patternType: 'multi',
                singlePattern: null,
                multiPattern: 'multi_3',
            },
            {
                barIndex: 4,
                patternType: 'single',
                singlePattern: 'pattern_4',
                multiPattern: null,
            },
            {
                barIndex: 5,
                patternType: 'single',
                singlePattern: 'pattern_5',
                multiPattern: null,
            },
            {
                barIndex: 6,
                patternType: 'multi',
                singlePattern: null,
                multiPattern: 'multi_6',
            },
        ]);

        const r = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx,
            rt
        )) as { candlePatterns: Array<{ date: string; pattern: string }> };

        // Exactly 2 — the freshest single + freshest multi, NOT the last 5
        // raw entries the old `.slice(-MAX_BAR_CANDLE_PATTERNS)` would keep.
        expect(r.candlePatterns).toHaveLength(2);
        const detectionWindow = bars.slice(-15);
        // Sorted by barIndex ascending: single (5) before multi (6).
        // timeframe is '1Day' → date-only (spec §3.1 B2 timestamp fix).
        expect(r.candlePatterns[0]).toEqual({
            date: new Date(detectionWindow[5]!.time * 1000)
                .toISOString()
                .slice(0, 10),
            pattern: 'pattern_5',
        });
        expect(r.candlePatterns[1]).toEqual({
            date: new Date(detectionWindow[6]!.time * 1000)
                .toISOString()
                .slice(0, 10),
            pattern: 'multi_6',
        });
    });

    it('candlePatterns: intraday timeframe는 date가 전체 ISO instant(Z 포함)다', async () => {
        profile.mockResolvedValue('us-equity');
        const bars = Array.from({ length: 20 }, (_, i) =>
            bar(1_700_000_000 + i * 3_600, 100 + i)
        );
        getCachedBars.mockResolvedValue({ bars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);
        detectCandlePatternEntries.mockReturnValue([
            {
                barIndex: 6,
                patternType: 'single',
                singlePattern: 'pattern_6',
                multiPattern: null,
            },
        ]);

        const r = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Hour' },
            ctx,
            rt
        )) as { candlePatterns: Array<{ date: string; pattern: string }> };
        const detectionWindow = bars.slice(-15);
        expect(r.candlePatterns[0]!.date).toBe(
            new Date(detectionWindow[6]!.time * 1000).toISOString()
        );
    });

    it('bars:200 처럼 예산을 초과하면 가장 오래된 봉부터 잘라 최신 봉을 보존한다', async () => {
        profile.mockResolvedValue('us-equity');
        const SOURCE_BARS = 250;
        const bars = Array.from({ length: SOURCE_BARS }, (_, i) =>
            bar(1_700_000_000 + i * 86_400, 100 + i)
        );
        getCachedBars.mockResolvedValue({ bars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue(
            Array.from({ length: 5 }, (_, i) => ({
                type: `signal_${i}`,
                direction: 'bullish',
                phase: 'confirmed',
                detectedAt: 0,
            }))
        );

        const raw = await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day', bars: 200 },
            ctx,
            rt
        );
        // `fitBarsToBudget` itself must target `BARS_RESULT_MAX_CHARS`
        // (6,000), not the shared `TOOL_RESULT_MAX_CHARS` (4,000) — the raw
        // (pre-registry) result should already sit close to the LARGER
        // ceiling, strictly above the smaller one, proving the fit ran
        // against 6,000 rather than silently trimming to 4,000.
        const rawSerializedLength = JSON.stringify(raw).length;
        expect(rawSerializedLength).toBeLessThanOrEqual(BARS_RESULT_MAX_CHARS);
        expect(rawSerializedLength).toBeGreaterThan(TOOL_RESULT_MAX_CHARS);

        // Simulates the registry's actual ceiling for this tool
        // (`tools/index.ts`'s `ceilingFor` routes `get_bars_indicators` to
        // `BARS_RESULT_MAX_CHARS`, not the shared `TOOL_RESULT_MAX_CHARS`).
        const registryOutput = truncateToolResult(raw, BARS_RESULT_MAX_CHARS);
        const serialized = JSON.stringify(registryOutput);

        expect(serialized.length).toBeLessThanOrEqual(BARS_RESULT_MAX_CHARS);

        const r = raw as {
            barsReturned: number;
            barsTrimmed: number;
            bars: Array<{ c: number }>;
        };
        expect(r.barsTrimmed).toBeGreaterThan(0);
        // The newest bar (close = 100 + SOURCE_BARS - 1) must survive the trim —
        // it's the last element of the source array (oldest-first).
        const newestClose = 100 + SOURCE_BARS - 1;
        expect(r.bars.at(-1)?.c).toBe(newestClose);
        expect(serialized).toContain(String(newestClose));
    });

    it('예산 초과 시 pullback.measured(긴 고정 문단)가 켜져 있어도 봉만 더 잘리고 판독·최신 봉은 온전히 남는다', async () => {
        profile.mockResolvedValue('us-equity');
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);
        const SOURCE_BARS = 250;
        const rising = Array.from({ length: SOURCE_BARS }, (_, i) =>
            bar(1_700_000_000 + i * 86_400, 100 + i)
        );
        // Same series with the last close dropped below its 14-bar low while
        // still above MA200 (≈249): Williams %R -100 lights the reading.
        const CRASH_CLOSE = 300;
        const washout = [
            ...rising.slice(0, -1),
            bar(rising.at(-1)!.time, CRASH_CLOSE),
        ];
        const run = async (bars: typeof rising) => {
            getCachedBars.mockResolvedValue({ bars, indicators });
            return (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day', bars: 200 },
                ctx,
                rt
            )) as {
                barsTrimmed: number;
                bars: Array<{ c: number }>;
                pullback: { reading: string; measured: string } | null;
            };
        };

        const quiet = await run(rising);
        const lit = await run(washout);

        expect(quiet.pullback).toBeNull();
        expect(lit.pullback?.reading).toBe('washoutInUptrend');
        expect(lit.pullback?.measured).toBeTruthy();
        expect(JSON.stringify(lit).length).toBeLessThanOrEqual(
            BARS_RESULT_MAX_CHARS
        );
        // The paragraph displaces bars, never itself: more bars are trimmed…
        expect(lit.barsTrimmed).toBeGreaterThan(quiet.barsTrimmed);
        // …and the newest bar still survives.
        expect(lit.bars.at(-1)?.c).toBe(CRASH_CLOSE);
    });

    it('confluence: 전체 캐시 봉(요청 bars 아님)으로 core evaluateConfluence를 돌려 압축 형태로 싣는다', async () => {
        profile.mockResolvedValue('us-equity');
        // Oscillating uptrend — the real detector catalogue lights several
        // signals on it and ma50 comes out non-integer (exercises rounding).
        const bars = Array.from({ length: 150 }, (_, i) =>
            bar(
                1_700_000_000 + i * 86_400,
                100 + 10 * Math.sin(i / 8) + i * 0.1
            )
        );
        getCachedBars.mockResolvedValue({ bars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);

        const r = (await getBarsIndicatorsTool(
            // bars:10 < CONFLUENCE_MIN_BARS — confluence must still read the full series.
            { symbol: 'AAPL', timeframe: '1Day', bars: 10 },
            ctx,
            rt
        )) as { confluence: Record<string, unknown> | null };

        // `evaluateConfluence`/`scoreConfluence`/`aggregateBarsToWeekly` are
        // core's real implementations (the module mock spreads `...actual`
        // and only observes `evaluateConfluence`), so this is the real
        // computation — '1Day's higher timeframe is the weekly aggregation of
        // the SAME cached daily bars. The view carries neither the rule
        // states nor `htfGate` (2026-10-03): the model misnamed both.
        const weeklyBars = aggregateBarsToWeekly(bars);
        const snapshot = evaluateConfluence(bars, {
            timeframe: '1Day',
            htfBars: weeklyBars,
            htfLabel: '1Week',
        });
        expect(snapshot).not.toBeNull();
        expect(snapshot!.bullish.length).toBeGreaterThan(0);
        expect(r.confluence).toEqual({
            score: scoreConfluence(snapshot),
            bullish: snapshot!.bullish,
            bearish: snapshot!.bearish,
            freshBullish: snapshot!.freshBullish,
            freshBearish: snapshot!.freshBearish,
            ma50: roundNumber(snapshot!.ma50!),
        });
    });

    it('confluence: htfBars가 로드되면 core evaluateConfluence에 htfBars가 전달된다(점수의 92 고정이 상위 타임프레임 조건을 반영)', async () => {
        profile.mockResolvedValue('us-equity');
        const bars = Array.from({ length: 150 }, (_, i) =>
            bar(1_700_000_000 + i * 3_600, 100 + 10 * Math.sin(i / 8) + i * 0.1)
        );
        const htfBars = Array.from({ length: 150 }, (_, i) =>
            bar(1_700_000_000 + i * 86_400, 100 + i * 0.2)
        );
        // First call = main '1Hour' bars, second = '4Hour' HTF bars.
        getCachedBars
            .mockResolvedValueOnce({ bars, indicators })
            .mockResolvedValueOnce({ bars: htfBars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);

        const r = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Hour', bars: 10 },
            ctx,
            rt
        )) as { confluence: Record<string, unknown> | null };

        const call = evaluateConfluenceSpy.mock.calls.find(
            ([series, opts]) => series === bars && opts?.timeframe === '1Hour'
        );
        expect(call?.[1]).toMatchObject({ htfBars, htfLabel: '4Hour' });
        expect(r.confluence).not.toHaveProperty('htfGate');
    });

    it('confluence: CONFLUENCE_MIN_BARS 미만이면 null(기권)', async () => {
        profile.mockResolvedValue('us-equity');
        const bars = Array.from({ length: CONFLUENCE_MIN_BARS - 1 }, (_, i) =>
            bar(1_700_000_000 + i * 86_400, 100 + i)
        );
        getCachedBars.mockResolvedValue({ bars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);

        const r = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx,
            rt
        )) as Record<string, unknown>;
        expect(r).toHaveProperty('confluence', null);
    });

    it('모델이 준 bars는 1..200으로 제한된다(0은 slice(-0) 전체 반환 함정)', async () => {
        profile.mockResolvedValue('us-equity');
        const bars = Array.from({ length: 50 }, (_, i) =>
            bar(1_700_000_000 + i * 86_400, 100 + i)
        );
        getCachedBars.mockResolvedValue({ bars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);
        const barsFor = async (requested: unknown) =>
            (
                (await getBarsIndicatorsTool(
                    { symbol: 'AAPL', timeframe: '1Day', bars: requested },
                    ctx,
                    rt
                )) as { bars: unknown[] }
            ).bars.length;
        // `slice(-0)` returns the WHOLE array, so 0 must clamp to 1, not 50.
        expect(await barsFor(0)).toBe(1);
        expect(await barsFor(-5)).toBe(1);
        expect(await barsFor(Number.NaN)).toBe(30);
    });

    describe('derived (spec §3.1, B1)', () => {
        /** The `1Day` date the tool prints for a bar time. */
        const day = (t: number) =>
            new Date(t * 1000).toISOString().slice(0, 10);
        /** The intraday instant the tool prints for a bar time. */
        const instant = (t: number) => new Date(t * 1000).toISOString();
        const barV = (time: number, close: number, volume = 100) => ({
            time,
            open: close,
            high: close + 1,
            low: close - 1,
            close,
            volume,
        });

        it('lastClose/changePct/range/volumeVsAvg20/atrPct/priceVsMa를 정확히 계산한다', async () => {
            profile.mockResolvedValue('us-equity');
            const bars = Array.from({ length: 60 }, (_, i) =>
                barV(1_700_000_000 + i * 86_400, 100 + i, i === 59 ? 300 : 100)
            );
            getCachedBars.mockResolvedValue({
                bars,
                indicators: {
                    ...indicators,
                    ma: { 20: [2] },
                    ema: { 20: [2] },
                    atr: [3],
                },
            });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);

            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                ctx,
                rt
            )) as { derived: Record<string, unknown> };

            expect(r.derived.lastClose).toBe(159);
            expect(r.derived.changePct).toEqual({
                '1bar': roundNumber(((159 - 158) / 158) * 100),
                '5bars': roundNumber(((159 - 154) / 154) * 100),
                '20bars': roundNumber(((159 - 139) / 139) * 100),
                '60bars': null, // exactly 60 bars — not `bars.length > 60`
                '252bars': null,
            });
            expect(r.derived.range).toEqual({
                high: 160,
                highDate: day(bars[59]!.time),
                low: 99,
                lowDate: day(bars[0]!.time),
                fromHighPct: roundNumber(((159 - 160) / 160) * 100),
                fromLowPct: roundNumber(((159 - 99) / 99) * 100),
                bars: 60,
            });
            expect(r.derived.volumeVsAvg20).toBe(roundNumber(300 / 100));
            expect(r.derived.atrPct).toBe(roundNumber((3 / 159) * 100)); // ATR is atr/price, not a "vs base" diff
            // Mean of the last MA50_PERIOD closes of this
            // fixture, computed independently of core's calculateMA.
            const maWindow = bars.slice(-MA50_PERIOD).map(b => b.close);
            const ma50 =
                maWindow.reduce((sum, c) => sum + c, 0) / maWindow.length;
            expect(r.derived.priceVsMa).toEqual({
                ma50Pct: roundNumber(((159 - ma50) / ma50) * 100),
                ma20Pct: roundNumber(((159 - 2) / 2) * 100),
                ema20Pct: roundNumber(((159 - 2) / 2) * 100),
            });
            // Last 20 bars (i=40..59): closes 140..159, highs 141..160, lows 139..158.
            // Last 60 bars = the whole fixture, same window `range` already used.
            expect(r.derived.ranges).toEqual({
                '20bars': {
                    high: 160,
                    highDate: day(bars[59]!.time),
                    low: 139,
                    lowDate: day(bars[40]!.time),
                    fromHighPct: roundNumber(((159 - 160) / 160) * 100),
                    fromLowPct: roundNumber(((159 - 139) / 139) * 100),
                },
                '60bars': {
                    high: 160,
                    highDate: day(bars[59]!.time),
                    low: 99,
                    lowDate: day(bars[0]!.time),
                    fromHighPct: roundNumber(((159 - 160) / 160) * 100),
                    fromLowPct: roundNumber(((159 - 99) / 99) * 100),
                },
            });
        });

        it('null rule: zero/negative base, NaN, null 입력은 모두 null (base>0 아니면 % 없음)', async () => {
            profile.mockResolvedValue('us-equity');
            const bars = [barV(1_700_000_000, 100), barV(1_700_086_400, 101)];
            getCachedBars.mockResolvedValue({
                bars,
                indicators: {
                    ...indicators,
                    ma: { 20: [0], 60: [-5], 120: [null] },
                    ema: {},
                    atr: [Number.NaN],
                },
            });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);

            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                ctx,
                rt
            )) as { derived: Record<string, unknown> };

            expect(r.derived.priceVsMa).toEqual({
                ma50Pct: null, // only 2 bars loaded — far under the 50-bar MA period
                ma20Pct: null, // base === 0
                ma60Pct: null, // base < 0
                ma120Pct: null, // base === null
            });
            expect(r.derived.atrPct).toBeNull(); // atr === NaN
            expect(
                (r.derived.changePct as Record<string, unknown>)['5bars']
            ).toBeNull(); // not enough bars
        });

        it('range: 유한한 high/low가 하나도 없으면 high/low/pct 전부 null (bars 카운트는 유지)', async () => {
            profile.mockResolvedValue('us-equity');
            const badBars = [
                {
                    time: 1_700_000_000,
                    open: 100,
                    high: Number.NaN,
                    low: Number.POSITIVE_INFINITY,
                    close: 100,
                    volume: 100,
                },
                {
                    time: 1_700_086_400,
                    open: 101,
                    high: Number.NaN,
                    low: Number.NaN,
                    close: 101,
                    volume: 100,
                },
            ];
            getCachedBars.mockResolvedValue({ bars: badBars, indicators });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);
            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                ctx,
                rt
            )) as {
                derived: {
                    range: {
                        high: number | null;
                        low: number | null;
                        fromHighPct: number | null;
                        fromLowPct: number | null;
                        bars: number;
                    };
                };
            };
            expect(r.derived.range).toEqual({
                high: null,
                highDate: null,
                low: null,
                lowDate: null,
                fromHighPct: null,
                fromLowPct: null,
                bars: 2,
            });
        });

        it('volumeVsAvg20: 마지막 거래량이나 평균에 들어가는 거래량 중 하나라도 비유한값이면 null (NaN이 roundNumber에 닿지 않는다)', async () => {
            profile.mockResolvedValue('us-equity');
            // 21 bars: 20 prior (one NaN) + 1 last.
            const bars = Array.from({ length: 21 }, (_, i) =>
                barV(
                    1_700_000_000 + i * 86_400,
                    100 + i,
                    i === 5 ? Number.NaN : 100
                )
            );
            getCachedBars.mockResolvedValue({ bars, indicators });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);
            let r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                ctx,
                rt
            )) as { derived: { volumeVsAvg20: number | null } };
            expect(r.derived.volumeVsAvg20).toBeNull();

            // Now a finite average, but the LAST volume itself is NaN.
            const bars2 = Array.from({ length: 21 }, (_, i) =>
                barV(
                    1_700_000_000 + i * 86_400,
                    100 + i,
                    i === 20 ? Number.NaN : 100
                )
            );
            getCachedBars.mockResolvedValue({ bars: bars2, indicators });
            r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                ctx,
                rt
            )) as { derived: { volumeVsAvg20: number | null } };
            expect(r.derived.volumeVsAvg20).toBeNull();
        });

        it('maStack: MA_DEFAULT_PERIODS 값이 있는 것만으로 bullish/bearish/mixed/null을 판정한다', async () => {
            profile.mockResolvedValue('us-equity');
            const bars = [barV(1_700_000_000, 100)];
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);
            const stackFor = async (ma: Record<number, (number | null)[]>) => {
                profile.mockResolvedValue('us-equity');
                getCachedBars.mockResolvedValue({
                    bars,
                    indicators: { ...indicators, ma },
                });
                const r = (await getBarsIndicatorsTool(
                    { symbol: 'AAPL', timeframe: '1Day' },
                    ctx,
                    rt
                )) as { derived: { maStack: string | null } };
                return r.derived.maStack;
            };
            expect(
                await stackFor({
                    5: [110],
                    20: [105],
                    60: [100],
                    120: [95],
                    200: [90],
                })
            ).toBe('bullish');
            expect(
                await stackFor({
                    5: [90],
                    20: [95],
                    60: [100],
                    120: [105],
                    200: [110],
                })
            ).toBe('bearish');
            expect(await stackFor({ 5: [100], 20: [110], 60: [90] })).toBe(
                'mixed'
            );
            expect(await stackFor({ 20: [100] })).toBeNull(); // < 2 periods present
        });

        it('intraday range는 daily 252봉 상한 없이 로드된 전체 봉을 쓴다', async () => {
            profile.mockResolvedValue('us-equity');
            const bars = Array.from({ length: 30 }, (_, i) =>
                barV(1_700_000_000 + i * 3_600, 100 + i)
            );
            getCachedBars.mockResolvedValue({ bars, indicators });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);
            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Hour' },
                ctx,
                rt
            )) as { derived: { range: { bars: number } } };
            expect(r.derived.range.bars).toBe(30);
        });

        it('ranges: 20bars/60bars는 timeframe과 무관하게 고정 봉 수 윈도우이고, 모자란 쪽만 null이다', async () => {
            profile.mockResolvedValue('us-equity');
            // 45 bars: enough for the 20bars window, not enough for 60bars.
            const bars = Array.from({ length: 45 }, (_, i) =>
                barV(1_700_000_000 + i * 3_600, 100 + i)
            );
            getCachedBars.mockResolvedValue({ bars, indicators });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);
            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Hour' },
                ctx,
                rt
            )) as { derived: { ranges: Record<string, unknown> } };

            // Last 20 bars (i=25..44): closes 125..144, highs 126..145, lows 124..143.
            expect(r.derived.ranges).toEqual({
                '20bars': {
                    high: 145,
                    highDate: instant(bars[44]!.time),
                    low: 124,
                    lowDate: instant(bars[25]!.time),
                    fromHighPct: roundNumber(((144 - 145) / 145) * 100),
                    fromLowPct: roundNumber(((144 - 124) / 124) * 100),
                },
                '60bars': null, // only 45 bars loaded
            });
        });

        it('ranges: 윈도우 안의 NaN high 하나는 나머지 유한값으로 무시된다(Math.max가 NaN에 전부 오염되지 않는다)', async () => {
            profile.mockResolvedValue('us-equity');
            // Exactly 20 bars so the whole fixture IS the 20bars window.
            // Closes 100..119, highs 101..120 — the LAST bar (i=19) would be
            // the natural max high; forcing it to NaN proves the filter, not
            // just a coincidental non-max NaN.
            const bars = Array.from({ length: 20 }, (_, i) =>
                barV(1_700_000_000 + i * 3_600, 100 + i)
            );
            bars[19] = { ...bars[19]!, high: Number.NaN };
            getCachedBars.mockResolvedValue({ bars, indicators });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);
            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                ctx,
                rt
            )) as {
                derived: { ranges: { '20bars': { high: number | null } } };
            };

            // Without the finite filter, Math.max(...highs) would be NaN —
            // the next-highest finite high (bar 18's 119) must survive instead.
            expect(r.derived.ranges['20bars'].high).toBe(119);
        });

        it('range/ranges dates: a tie resolves to the most recent bar', async () => {
            profile.mockResolvedValue('us-equity');
            // Flat 100 closes; highs peak at 120 on bars 3 and 10, lows bottom
            // at 80 on bars 5 and 15.
            const bars = Array.from({ length: 20 }, (_, i) => ({
                ...barV(1_700_000_000 + i * 86_400, 100),
                high: i === 3 || i === 10 ? 120 : 101,
                low: i === 5 || i === 15 ? 80 : 99,
            }));
            getCachedBars.mockResolvedValue({ bars, indicators });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);
            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                ctx,
                rt
            )) as {
                derived: {
                    range: { highDate: string | null; lowDate: string | null };
                    ranges: {
                        '20bars': {
                            highDate: string | null;
                            lowDate: string | null;
                        };
                    };
                };
            };
            expect(r.derived.range.highDate).toBe(day(bars[10]!.time));
            expect(r.derived.range.lowDate).toBe(day(bars[15]!.time));
            expect(r.derived.ranges['20bars'].highDate).toBe(
                day(bars[10]!.time)
            );
        });

        describe('252bars and calendarChange (dev-2026-10-22 A4·A10)', () => {
            /** Weekday-only daily bars (UTC midnight) from `from` through `to`, close = 100 + index. */
            const weekdayBars = (from: string, to: string) => {
                const out: ReturnType<typeof barV>[] = [];
                for (
                    let t = Date.parse(`${from}T00:00:00Z`);
                    t <= Date.parse(`${to}T00:00:00Z`);
                    t += 86_400_000
                ) {
                    const dow = new Date(t).getUTCDay();
                    if (dow === 0 || dow === 6) continue;
                    out.push(barV(t / 1000, 100 + out.length));
                }
                return out;
            };
            const run = async (
                bars: ReturnType<typeof barV>[],
                timeframe: '1Day' | '1Hour' = '1Day'
            ) => {
                profile.mockResolvedValue('us-equity');
                getCachedBars.mockResolvedValue({ bars, indicators });
                classify.mockReturnValue('uptrend');
                detect.mockReturnValue([]);
                return (await getBarsIndicatorsTool(
                    { symbol: 'AAPL', timeframe },
                    ctx,
                    rt
                )) as {
                    derived: {
                        changePct: Record<string, number | null>;
                        calendarChange: Record<
                            string,
                            {
                                baseDate: string;
                                baseClose: number;
                                pct: number | null;
                            } | null
                        > | null;
                    };
                };
            };
            const closeOn = (bars: ReturnType<typeof barV>[], date: string) =>
                bars.find(b => day(b.time) === date)!.close;

            it('changePct.252bars compares with the close 252 bars back', async () => {
                const bars = weekdayBars('2025-01-01', '2026-10-19');
                const r = await run(bars);
                const lastClose = bars.at(-1)!.close;
                expect(r.derived.changePct['252bars']).toBe(
                    pctVs(lastClose, bars[bars.length - 1 - 252]!.close)
                );
            });

            it('calendarChange: base is the last session on or before the date 1/3/12 calendar months back', async () => {
                // Last session Mon 2026-10-19 → targets Sat 09-19, Sun 07-19 and
                // Sun 2025-10-19, so each base is the Friday before.
                const bars = weekdayBars('2025-01-01', '2026-10-19');
                const r = await run(bars);
                const lastClose = bars.at(-1)!.close;
                const expected = (baseDate: string) => ({
                    baseDate,
                    baseClose: closeOn(bars, baseDate),
                    pct: pctVs(lastClose, closeOn(bars, baseDate)),
                });
                expect(r.derived.calendarChange).toEqual({
                    '1month': expected('2026-09-18'),
                    '3months': expected('2026-07-17'),
                    '1year': expected('2025-10-17'),
                });
                // A calendar month is not 20 bars: the two returns differ here.
                expect(r.derived.calendarChange!['1month']!.pct).not.toBe(
                    r.derived.changePct['20bars']
                );
            });

            it('calendarChange: a period the loaded series does not reach is null', async () => {
                const bars = weekdayBars('2026-08-01', '2026-10-19');
                const r = await run(bars);
                expect(r.derived.calendarChange!['1month']).not.toBeNull();
                expect(r.derived.calendarChange!['3months']).toBeNull();
                expect(r.derived.calendarChange!['1year']).toBeNull();
                expect(r.derived.changePct['252bars']).toBeNull();
            });

            it('calendarChange is null on intraday timeframes', async () => {
                const bars = Array.from({ length: 30 }, (_, i) =>
                    barV(1_700_000_000 + i * 3_600, 100 + i)
                );
                const r = await run(bars, '1Hour');
                expect(r.derived.calendarChange).toBeNull();
            });
        });

        it('priceVsMa.ma50Pct: core calculateMA로 직접 계산되어 기간보다 1봉 모자라면 null, intraday에서도 채워진다', async () => {
            profile.mockResolvedValue('us-equity');
            const oneShort = Array.from({ length: MA50_PERIOD - 1 }, (_, i) =>
                barV(1_700_000_000 + i * 86_400, 100 + i)
            );
            getCachedBars.mockResolvedValue({
                bars: oneShort,
                indicators: { ...indicators, ma: {}, ema: {} },
            });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);
            let r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                ctx,
                rt
            )) as { derived: { priceVsMa: Record<string, unknown> } };
            expect(r.derived.priceVsMa.ma50Pct).toBeNull(); // one close short of the MA period

            // Intraday timeframe, a few bars past the period — the expected
            // mean is taken straight from the fixture's last-period closes.
            const pastPeriod = Array.from({ length: MA50_PERIOD + 5 }, (_, i) =>
                barV(1_700_000_000 + i * 3_600, 100 + i)
            );
            const intradayWindow = pastPeriod
                .slice(-MA50_PERIOD)
                .map(b => b.close);
            const intradayMa =
                intradayWindow.reduce((sum, c) => sum + c, 0) /
                intradayWindow.length;
            const intradayLast = pastPeriod[pastPeriod.length - 1]!.close;
            getCachedBars.mockResolvedValue({
                bars: pastPeriod,
                indicators: { ...indicators, ma: {}, ema: {} },
            });
            r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Hour' },
                ctx,
                rt
            )) as { derived: { priceVsMa: Record<string, unknown> } };
            expect(r.derived.priceVsMa.ma50Pct).toBe(
                roundNumber(((intradayLast - intradayMa) / intradayMa) * 100)
            );
        });

        it('priceVsMa.ma50Pct: indicators.ma에 period 50이 있으면 그 값이 core 계산값을 덮어쓴다', async () => {
            profile.mockResolvedValue('us-equity');
            const bars = Array.from({ length: 60 }, (_, i) =>
                barV(1_700_000_000 + i * 86_400, 100 + i)
            );
            getCachedBars.mockResolvedValue({
                bars,
                indicators: {
                    ...indicators,
                    ma: { [MA50_PERIOD]: [999] },
                    ema: {},
                },
            });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);
            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                ctx,
                rt
            )) as { derived: { priceVsMa: Record<string, unknown> } };
            // indicators.ma['50'] must win over the fallback `calculateMA`
            // computation (lastClose = 159, i=59).
            expect(r.derived.priceVsMa.ma50Pct).toBe(pctVs(159, 999));
        });
    });

    describe('pullback (단기 과매도 눌림 판독 — core evaluatePullback 어댑터)', () => {
        interface PullbackResult {
            reading: string;
            williamsR: number;
            rsi2: number | null;
            closeVsMa200Pct: number;
            ma5: number | null;
            measured: string;
            caveat: string | null;
        }
        // 판독 경계값(-90/-80)과 MA200 기권 규칙은 core pullback 테스트가 소유한다.
        // 여기서는 일봉 게이트, 필드 이름·반올림, 기저율 문장 매핑만 고정한다.

        // 종가가 i에 따라 선형으로 오르거나(상승 추세) 내린다(하락 추세) — 마지막 종가가
        // MA200 위/아래 어느 쪽에 있는지가 fixture만으로 확정된다.
        const trendBars = (length: number, slope: number) =>
            Array.from({ length }, (_, i) =>
                bar(1_700_000_000 + i * 86_400, 300 + i * slope)
            );
        // 마지막 봉만 `close`로 바꾼다 — 14봉 저점 아래로 내리면 Williams %R은 -100.
        const endingAt = (
            bars: ReturnType<typeof trendBars>,
            close: number
        ) => [...bars.slice(0, -1), bar(bars.at(-1)!.time, close)];
        const meanOfLast = (bars: { close: number }[], n: number) =>
            bars.slice(-n).reduce((sum, b) => sum + b.close, 0) / n;

        const pullbackFor = async (
            bars: ReturnType<typeof trendBars>,
            timeframe = '1Day'
        ): Promise<PullbackResult | null> => {
            profile.mockResolvedValue('us-equity');
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);
            getCachedBars.mockResolvedValue({ bars, indicators });
            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe },
                ctx,
                rt
            )) as { pullback: PullbackResult | null };
            return r.pullback;
        };

        it('상승 추세 끝의 급락 종가는 washoutInUptrend이고 core 값을 반올림해 기저율 문장과 함께 싣는다', async () => {
            // 종가 300→429.5 상승 후 마지막 봉만 400 — 14봉 저점(423) 아래, MA200(≈380) 위.
            const bars = endingAt(trendBars(260, 0.5), 400);
            const r = await pullbackFor(bars);

            expect(r).toEqual({
                reading: 'washoutInUptrend',
                williamsR: -100,
                rsi2: expect.any(Number),
                closeVsMa200Pct: pctVs(400, meanOfLast(bars, 200)),
                ma5: roundNumber(meanOfLast(bars, 5)),
                measured: PULLBACK_BASE_RATES.washoutInUptrend,
                caveat: null,
            });
            // 하루 급락 뒤의 RSI(2)는 trader 규칙(< 10)의 과매도 영역이다.
            expect(r!.rsi2!).toBeLessThan(10);
        });

        it('하락 추세 끝의 급락 종가는 washoutBelowMa200이고 고위험 기저율을 싣는다', async () => {
            const r = await pullbackFor(endingAt(trendBars(260, -0.5), 150));
            expect(r?.reading).toBe('washoutBelowMa200');
            expect(r?.measured).toBe(PULLBACK_BASE_RATES.washoutBelowMa200);
            expect(r?.closeVsMa200Pct).toBeLessThan(0);
        });

        it('판독이 none이면 pullback 자체가 null이다 — 모델이 "없음"을 보고하지 않도록', async () => {
            // 상승 추세의 마지막 종가가 14봉 고점 — 과매도가 아니다.
            expect(await pullbackFor(trendBars(260, 0.5))).toBeNull();
        });

        it('RSI(2)는 판독과 무관하게 일봉 latest.rsi2로 싣고, 일봉이 아니면 null이다', async () => {
            const run = async (
                bars: ReturnType<typeof trendBars>,
                timeframe: string
            ) => {
                profile.mockResolvedValue('us-equity');
                classify.mockReturnValue('uptrend');
                detect.mockReturnValue([]);
                getCachedBars.mockResolvedValue({ bars, indicators });
                return (await getBarsIndicatorsTool(
                    { symbol: 'AAPL', timeframe },
                    ctx,
                    rt
                )) as {
                    pullback: PullbackResult | null;
                    latest: { rsi2: number | null };
                };
            };
            const quiet = await run(trendBars(260, 0.5), '1Day');
            expect(quiet.pullback).toBeNull();
            // Monotonic rise: RSI(2) pins at its ceiling.
            expect(quiet.latest.rsi2).toBe(100);

            const lit = await run(endingAt(trendBars(260, 0.5), 400), '1Day');
            expect(lit.latest.rsi2).toBe(lit.pullback?.rsi2);

            const intraday = await run(trendBars(260, 0.5), '1Hour');
            expect(intraday.latest.rsi2).toBeNull();

            // Below 200 daily bars core abstains, and rsi2 must follow it.
            const short = await run(trendBars(150, 0.5), '1Day');
            expect(short.latest.rsi2).toBeNull();
        });

        describe('caveat (core pullbackEventCaveat)', () => {
            const washoutBars = () => endingAt(trendBars(260, 0.5), 400);
            // 마지막 봉 직후에 발행된 악재 가이던스 — 뉴스 주도 급락이라 기저율이 적용되지 않는다.
            const guidanceEvent = (bars: ReturnType<typeof trendBars>) => ({
                publishedAt: new Date((bars.at(-1)!.time + 3_600) * 1000),
                category: 'guidance' as const,
                sentiment: 'bearish' as const,
                impact: 'high' as const,
            });

            it('불 켜진 판독에는 시장 이벤트·실적일·일봉을 core에 넘겨 얻은 caveat을 싣는다', async () => {
                const bars = washoutBars();
                const events = [guidanceEvent(bars)];
                findEvents.mockResolvedValue(events);
                resolveEarnings.mockResolvedValue(['2024-01-02']);
                spec.mockReturnValueOnce({ tag: 'session' });

                const r = await pullbackFor(bars);

                expect(caveatSpy).toHaveBeenCalledTimes(1);
                expect(caveatSpy).toHaveBeenCalledWith({
                    events,
                    earningsDates: ['2024-01-02'],
                    bars,
                });
                // 이벤트 창은 분석 경로와 같은 1Day 룩백 + 같은 세션이다.
                expect(lookback).toHaveBeenCalledWith('1Day', {
                    tag: 'session',
                });
                expect(findEvents).toHaveBeenCalledWith(
                    { tag: 'db' },
                    expect.objectContaining({
                        symbol: 'AAPL',
                        lookbackDays: 60,
                    })
                );
                expect(resolveEarnings).toHaveBeenCalledWith('AAPL', {
                    tag: 'db',
                });
                const expected = caveatSpy.mock.results[0]!.value as
                    | string
                    | null;
                expect(expected).toEqual(expect.any(String));
                expect(r?.caveat).toBe(expected);
            });

            it('이벤트가 없으면 caveat은 null이다', async () => {
                const r = await pullbackFor(washoutBars());
                expect(r?.caveat).toBeNull();
            });

            it('이벤트 조회가 실패해도 도구는 판독을 유지하고 caveat만 null이다', async () => {
                const errorSpy = vi
                    .spyOn(console, 'error')
                    .mockImplementation(() => undefined);
                findEvents.mockRejectedValue(new Error('db down'));

                const r = await pullbackFor(washoutBars());

                expect(r?.reading).toBe('washoutInUptrend');
                expect(r?.caveat).toBeNull();
                expect(caveatSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
                errorSpy.mockRestore();
            });

            it('판독이 none이거나 일봉이 아니면 조회 자체를 하지 않는다', async () => {
                await pullbackFor(trendBars(260, 0.5));
                await pullbackFor(washoutBars(), '1Hour');
                expect(findEvents).not.toHaveBeenCalled();
                expect(resolveEarnings).not.toHaveBeenCalled();
            });
        });

        it('일봉이 아니거나 core가 기권하면(200봉 미만) null이다', async () => {
            const washout = endingAt(trendBars(260, 0.5), 400);
            expect(await pullbackFor(washout, '1Hour')).toBeNull();
            expect(
                await pullbackFor(endingAt(trendBars(199, 0.5), 350))
            ).toBeNull();
        });
    });

    describe('higherTimeframe (spec §3.1, B3)', () => {
        it("timeframe '1Day'는 이미 로드된 daily bars를 aggregateBarsToWeekly로 집계해 weekly HTF를 만든다(추가 캐시 조회 없음); weekly 데이터가 부족하면(<120봉) confluenceScore/priceVsMa50Pct는 null로 기권한다", async () => {
            profile.mockResolvedValue('us-equity');
            const bars = Array.from({ length: 30 }, (_, i) =>
                bar(1_700_000_000 + i * 86_400, 100 + i)
            );
            getCachedBars.mockResolvedValue({ bars, indicators });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);

            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                ctx,
                rt
            )) as {
                higherTimeframe: {
                    timeframe: string;
                    trend: string;
                    confluenceScore: number | null;
                    priceVsMa50Pct: number | null;
                } | null;
            };
            // 30 daily bars → ~5 weekly bars, far under CONFLUENCE_MIN_BARS
            // (120) — core abstains, not a fake neutral score.
            expect(r.higherTimeframe).not.toBeNull();
            expect(r.higherTimeframe!.timeframe).toBe('1Week');
            expect(r.higherTimeframe!.confluenceScore).toBeNull();
            expect(r.higherTimeframe!.priceVsMa50Pct).toBeNull();
            // Weekly aggregation reuses the SAME already-loaded daily bars —
            // no second `getCachedBarsWithIndicators` call for '1Day'.
            expect(getCachedBars).toHaveBeenCalledTimes(1);
        });

        it("timeframe '1Day': weekly 데이터가 충분하면(>=120봉) confluenceScore/rsi가 core의 실제 계산과 일치한다", async () => {
            profile.mockResolvedValue('us-equity');
            // ~900 daily bars → well over 120 weekly bars.
            const bars = Array.from({ length: 900 }, (_, i) =>
                bar(
                    1_700_000_000 + i * 86_400,
                    100 + 20 * Math.sin(i / 30) + i * 0.05
                )
            );
            getCachedBars.mockResolvedValue({ bars, indicators });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);

            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                ctx,
                rt
            )) as {
                higherTimeframe: {
                    timeframe: string;
                    confluenceScore: number | null;
                    rsi: number | null;
                } | null;
            };

            // Real core computation on the same weekly aggregation, as the
            // oracle for what the tool should have produced.
            const weeklyBars = aggregateBarsToWeekly(bars);
            const weeklyIndicators = calculateIndicators(weeklyBars);
            const weeklySnapshot = evaluateConfluence(weeklyBars, {
                timeframe: '1Week',
            });
            expect(weeklySnapshot).not.toBeNull(); // sanity: fixture actually clears CONFLUENCE_MIN_BARS
            expect(r.higherTimeframe!.confluenceScore).toBe(
                scoreConfluence(weeklySnapshot)
            );
            const lastRsi = weeklyIndicators.rsi.at(-1) ?? null;
            expect(r.higherTimeframe!.rsi).toBe(
                lastRsi !== null && Number.isFinite(lastRsi)
                    ? roundNumber(lastRsi)
                    : null
            );
        });

        it("timeframe '1Day', 프로덕션 규모(500봉): weekly 봉이 CONFLUENCE_MIN_BARS(120) 미만이라 confluenceScore는 기권(null)이지만, 50개 이상의 종가는 있으므로 priceVsMa50Pct는 trailing 50-period 평균으로 실제 값을 낸다", async () => {
            profile.mockResolvedValue('us-equity');
            // 500 daily bars (production max — see `getCachedBarsWithIndicators`
            // callers elsewhere) → ~101 weekly bars: over 50 (enough for a
            // trailing SMA) but under CONFLUENCE_MIN_BARS (120, so core's own
            // confluence scoring still abstains for every '1Day' request).
            const bars = Array.from({ length: 500 }, (_, i) =>
                bar(
                    1_700_000_000 + i * 86_400,
                    100 + 20 * Math.sin(i / 30) + i * 0.05
                )
            );
            getCachedBars.mockResolvedValue({ bars, indicators });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);

            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                ctx,
                rt
            )) as {
                higherTimeframe: {
                    confluenceScore: number | null;
                    priceVsMa50Pct: number | null;
                } | null;
            };

            const weeklyBars = aggregateBarsToWeekly(bars);
            expect(weeklyBars.length).toBeGreaterThanOrEqual(50);
            expect(weeklyBars.length).toBeLessThan(CONFLUENCE_MIN_BARS);
            const weeklySnapshot = evaluateConfluence(weeklyBars, {
                timeframe: '1Week',
            });
            expect(weeklySnapshot).toBeNull(); // sanity: fixture stays under core's own gate

            expect(r.higherTimeframe!.confluenceScore).toBeNull();

            // Oracle: the SAME `calculateMA` + `pctVs` the
            // source uses — real, unmocked core functions, not a hand-rolled
            // reimplementation.
            const ma50 = calculateMA(weeklyBars, CONFLUENCE_TREND_MA_PERIOD).at(
                -1
            );
            const lastClose = weeklyBars.at(-1)!.close;
            expect(r.higherTimeframe!.priceVsMa50Pct).toBe(
                pctVs(lastClose, ma50)
            );
            expect(r.higherTimeframe!.priceVsMa50Pct).not.toBeNull();
        });

        it('intraday timeframe은 매핑된 상위 timeframe의 봉을 두 번째 캐시 호출로 불러와 trend/confluenceScore/priceVsMa50Pct/rsi를 채운다', async () => {
            profile.mockResolvedValue('us-equity');
            const bars = Array.from({ length: 150 }, (_, i) =>
                bar(
                    1_700_000_000 + i * 3_600,
                    100 + 10 * Math.sin(i / 8) + i * 0.1
                )
            );
            const htfBars = Array.from({ length: 150 }, (_, i) =>
                bar(1_700_000_000 + i * 86_400, 100 + i * 0.2)
            );
            const htfIndicators = { ...indicators, rsi: [1, 55] };
            getCachedBars
                .mockResolvedValueOnce({ bars, indicators })
                .mockResolvedValueOnce({
                    bars: htfBars,
                    indicators: htfIndicators,
                });
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);

            const r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Hour' },
                ctx,
                rt
            )) as {
                higherTimeframe: {
                    timeframe: string;
                    trend: string;
                    rsi: number | null;
                    confluenceScore: number | null;
                    priceVsMa50Pct: number | null;
                } | null;
            };
            expect(r.higherTimeframe).not.toBeNull();
            expect(r.higherTimeframe!.timeframe).toBe('4Hour'); // 1Hour → 4Hour mapping
            expect(r.higherTimeframe!.rsi).toBe(55);
            // Second call must target the mapped HTF timeframe, same symbol/session.
            expect(getCachedBars).toHaveBeenNthCalledWith(
                2,
                {},
                'AAPL',
                '4Hour',
                undefined,
                undefined
            );
            const htfSnapshot = evaluateConfluence(htfBars, {
                timeframe: '4Hour',
            });
            expect(r.higherTimeframe!.confluenceScore).toBe(
                scoreConfluence(htfSnapshot)
            );
        });

        it('higherTimeframe.rsi는 latest 값처럼 유효숫자 반올림되고, 비유한값이면 null', async () => {
            profile.mockResolvedValue('us-equity');
            const bars = Array.from({ length: 150 }, (_, i) =>
                bar(
                    1_700_000_000 + i * 3_600,
                    100 + 10 * Math.sin(i / 8) + i * 0.1
                )
            );
            const htfBars = Array.from({ length: 150 }, (_, i) =>
                bar(1_700_000_000 + i * 86_400, 100 + i * 0.2)
            );
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);

            getCachedBars
                .mockResolvedValueOnce({ bars, indicators })
                .mockResolvedValueOnce({
                    bars: htfBars,
                    indicators: { ...indicators, rsi: [1, 78.098971092601] },
                });
            let r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Hour' },
                ctx,
                rt
            )) as { higherTimeframe: { rsi: number | null } | null };
            expect(r.higherTimeframe!.rsi).toBe(roundNumber(78.098971092601));
            expect(r.higherTimeframe!.rsi).not.toBe(78.098971092601);

            getCachedBars
                .mockResolvedValueOnce({ bars, indicators })
                .mockResolvedValueOnce({
                    bars: htfBars,
                    indicators: { ...indicators, rsi: [1, Number.NaN] },
                });
            r = (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Hour' },
                ctx,
                rt
            )) as { higherTimeframe: { rsi: number | null } | null };
            expect(r.higherTimeframe!.rsi).toBeNull();
        });

        it('상위 timeframe 캐시 로드가 빈 배열이거나 throw하면 null로 내려가고 도구 자체는 죽지 않는다, throw는 degrade로 로그된다', async () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            try {
                profile.mockResolvedValue('us-equity');
                const bars = [bar(1_700_000_000, 100)];
                classify.mockReturnValue('uptrend');
                detect.mockReturnValue([]);

                getCachedBars
                    .mockResolvedValueOnce({ bars, indicators })
                    .mockResolvedValueOnce({ bars: [], indicators });
                let r = (await getBarsIndicatorsTool(
                    { symbol: 'AAPL', timeframe: '4Hour' },
                    ctx,
                    rt
                )) as { higherTimeframe: unknown };
                expect(r.higherTimeframe).toBeNull();

                getCachedBars
                    .mockResolvedValueOnce({ bars, indicators })
                    .mockRejectedValueOnce(new Error('provider down'));
                r = (await getBarsIndicatorsTool(
                    { symbol: 'AAPL', timeframe: '4Hour' },
                    ctx,
                    rt
                )) as { higherTimeframe: unknown };
                expect(r.higherTimeframe).toBeNull();
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    '[AgentTool]',
                    'get_bars_indicators',
                    'higher-timeframe bars fetch failed, degrading',
                    { errorName: 'Error', code: undefined }
                );
            } finally {
                consoleErrorSpy.mockRestore();
            }
        });
    });

    it('기본 요청(30봉, 1Day)은 운영 규모 일봉(500봉·실제 지표·공포탐욕)에서도 봉이 잘리지 않는다', async () => {
        profile.mockResolvedValue('us-equity');
        // 운영과 같은 모양: 500 거래일, 소수 둘째 자리 가격, 백만 단위 거래량.
        const DAY = 86_400;
        const start = Date.parse('2024-10-21T00:00:00Z') / 1000;
        const realistic = Array.from({ length: 500 }, (_, i) => {
            const close =
                Math.round((420 + Math.sin(i / 9) * 35 + i * 0.09) * 100) / 100;
            return {
                time: start + i * DAY,
                open: Math.round((close - 1.37) * 100) / 100,
                high: Math.round((close + 3.21) * 100) / 100,
                low: Math.round((close - 4.08) * 100) / 100,
                close,
                volume: 1_000_000 + ((i * 7_919) % 2_345_678),
            };
        });
        const computed = calculateIndicators(realistic);
        getCachedBars.mockResolvedValue({
            bars: realistic,
            indicators: {
                ...computed,
                buySellVolume: realistic.map((b, i) => ({
                    buyVolume: b.volume * (0.45 + ((i * 13) % 10) / 100),
                    sellVolume: b.volume * (0.45 + ((i * 7) % 10) / 100),
                })),
            },
        });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([
            {
                type: 'golden_cross',
                direction: 'bullish',
                phase: 'confirmed',
                detectedAt: 0,
            },
            {
                type: 'rsi_bullish_divergence',
                direction: 'bullish',
                phase: 'expected',
                detectedAt: 0,
            },
            {
                type: 'bollinger_squeeze',
                direction: 'neutral',
                phase: 'confirmed',
                detectedAt: 0,
            },
        ]);

        const r = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '1Day' },
            ctx,
            rt
        )) as { barsReturned: number; barsTrimmed: number };

        expect(r.barsTrimmed).toBe(0);
        expect(r.barsReturned).toBe(30);
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(
            BARS_RESULT_MAX_CHARS
        );
    });

    it('budget 절단 후에도 derived/higherTimeframe은 trim 대상 밖이라 그대로 남는다', async () => {
        profile.mockResolvedValue('us-equity');
        const SOURCE_BARS = 250;
        const bars = Array.from({ length: SOURCE_BARS }, (_, i) =>
            bar(1_700_000_000 + i * 3_600, 100 + i)
        );
        const htfBars = Array.from({ length: 100 }, (_, i) =>
            bar(1_700_000_000 + i * 86_400, 100 + i)
        );
        getCachedBars
            .mockResolvedValueOnce({ bars, indicators })
            .mockResolvedValueOnce({ bars: htfBars, indicators });
        classify.mockReturnValue('uptrend');
        detect.mockReturnValue([]);

        const raw = (await getBarsIndicatorsTool(
            { symbol: 'AAPL', timeframe: '4Hour', bars: 200 },
            ctx,
            rt
        )) as {
            barsTrimmed: number;
            derived: { lastClose: number | null };
            higherTimeframe: { timeframe: string } | null;
        };
        expect(raw.barsTrimmed).toBeGreaterThan(0);
        expect(raw.derived.lastClose).not.toBeNull();
        expect(raw.higherTimeframe).not.toBeNull();
        expect(raw.higherTimeframe!.timeframe).toBe('1Day');
    });

    describe('fearGreed groups and history', () => {
        const longBars = Array.from({ length: 400 }, (_, i) => {
            const close = 100 + Math.sin(i / 7) * 12 + i * 0.05;
            return {
                time: 1_600_000_000 + i * 86_400,
                open: close - 0.5,
                high: close + 1,
                low: close - 1,
                close,
                volume: 100 + ((i * 37) % 50),
            };
        });
        type View = {
            fearGreed: {
                groups: { name: string; label: string; score: number }[];
                history: Record<string, { date: string } | null>;
            };
        };
        const run = async (locale: 'ko' | 'en' | 'ja' | 'zh') => {
            profile.mockResolvedValue('us-equity');
            classify.mockReturnValue('uptrend');
            detect.mockReturnValue([]);
            getCachedBars.mockResolvedValue({
                bars: longBars,
                indicators: {
                    ...indicators,
                    buySellVolume: longBars.map((_, i) => ({
                        buyVolume: 60 + ((i * 13) % 20),
                        sellVolume: 40 + ((i * 7) % 20),
                    })),
                },
            });
            return (await getBarsIndicatorsTool(
                { symbol: 'AAPL', timeframe: '1Day' },
                { ...ctx, locale },
                rt
            )) as View;
        };

        it.each([
            ['ko', '수급', '추세'],
            ['en', 'Flow', 'Trend'],
            ['ja', '需給', 'トレンド'],
            ['zh', '资金流', '趋势'],
        ] as const)(
            '%s 로케일은 화면과 같은 그룹명을 붙이고 점수는 정수다',
            async (locale, flow, trend) => {
                const r = await run(locale);
                const byName = Object.fromEntries(
                    r.fearGreed.groups.map(g => [g.name, g])
                );
                expect(byName.Flow?.label).toBe(flow);
                expect(byName.Trend?.label).toBe(trend);
                for (const g of r.fearGreed.groups)
                    expect(Number.isInteger(g.score)).toBe(true);
            }
        );

        it('history는 일봉 날짜(YYYY-MM-DD)로 나온다', async () => {
            const r = await run('ko');
            const dates = Object.values(r.fearGreed.history).flatMap(p =>
                p ? [p.date] : []
            );
            expect(dates.length).toBeGreaterThan(0);
            for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('buildFearGreedHistoryView', () => {
        const series = (n: number, withWarmup = 0) => [
            ...Array.from({ length: withWarmup }, (_, i) => ({
                date: `w${i}`,
                score: null,
                label: null,
            })),
            ...Array.from({ length: n }, (_, i) => ({
                date: `d${i}`,
                score: i + 0.4,
                label: 'NEUTRAL' as const,
            })),
        ];

        it('거래일 오프셋(5/21/63/252)으로 점수가 있는 점만 센다', () => {
            const v = buildFearGreedHistoryView(series(300, 10));
            expect(v.weekAgo).toEqual({
                date: 'd294',
                score: 294,
                label: 'NEUTRAL',
            });
            expect(v.monthAgo?.date).toBe('d278');
            expect(v.threeMonthsAgo?.date).toBe('d236');
            expect(v.yearAgo?.date).toBe('d47');
        });

        it('연간 최저/최고는 페이지처럼 최근 252점 안에서 고른다', () => {
            const v = buildFearGreedHistoryView(series(300));
            expect(v.yearMin).toEqual({ date: 'd48', score: 48 });
            expect(v.yearMax).toEqual({ date: 'd299', score: 299 });
        });

        it('시계열이 짧으면 닿지 않는 지점은 null', () => {
            const v = buildFearGreedHistoryView(series(30));
            expect(v.weekAgo).not.toBeNull();
            expect(v.monthAgo).not.toBeNull();
            expect(v.threeMonthsAgo).toBeNull();
            expect(v.yearAgo).toBeNull();
            expect(v.yearMin).not.toBeNull();
        });

        it('동률은 먼저 나온 지점을 유지하고 비교는 원점수로 한다(페이지와 동일)', () => {
            const mk = (scores: number[]) =>
                scores.map((score, i) => ({
                    date: `t${i}`,
                    score,
                    label: 'NEUTRAL' as const,
                }));
            // raw 10.4 < 10.6 though both round to 10/11 apart; 20 ties twice.
            const v = buildFearGreedHistoryView(mk([20, 10.6, 10.4, 20, 15]));
            expect(v.yearMin).toEqual({ date: 't2', score: 10 });
            expect(v.yearMax).toEqual({ date: 't0', score: 20 });
        });

        it('페이지의 연간 범위·기간 비교 문장과 같은 지점을 가리킨다', () => {
            const history = series(300, 10);
            const v = buildFearGreedHistoryView(history);
            const points = scoredHistory(history);
            const echo = (key: string, values?: Record<string, unknown>) =>
                JSON.stringify([key, values]);
            const range = JSON.parse(
                buildFearGreedYearRangeLine(points, echo as never)!
            )[1];
            expect(range.v1).toBe(v.yearMin?.score);
            expect(range.v2).toBe(v.yearMin?.date);
            expect(range.v3).toBe(v.yearMax?.score);
            expect(range.v4).toBe(v.yearMax?.date);
            // 주/월/년 전 점수는 페이지 문장이 쓰는 `pointBefore`와 같은 값.
            const periods = buildFearGreedPeriodComparisonLine(
                points,
                echo as never,
                echo as never
            );
            for (const p of [v.weekAgo, v.monthAgo, v.yearAgo])
                expect(periods).toContain(String(p?.score));
        });

        it('점수 있는 점이 없으면 전부 null', () => {
            expect(buildFearGreedHistoryView(series(0, 5))).toEqual({
                weekAgo: null,
                monthAgo: null,
                threeMonthsAgo: null,
                yearAgo: null,
                yearMin: null,
                yearMax: null,
            });
        });
    });
});
