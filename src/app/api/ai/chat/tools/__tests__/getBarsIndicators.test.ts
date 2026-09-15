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
} = vi.hoisted(() => ({
    profile: vi.fn(),
    assetInfo: vi.fn(),
    getCachedBars: vi.fn(),
    classify: vi.fn(),
    detect: vi.fn(),
    spec: vi.fn(),
    detectCandlePatternEntries: vi.fn(),
    getDetectionBars: vi.fn(),
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...actual,
        classifyTrend: classify,
        detectSignals: detect,
        detectCandlePatternEntries,
        getDetectionBars,
    };
});
vi.mock('@/entities/bars/lib/barsDataCache', () => ({
    getCachedBarsWithIndicators: getCachedBars,
}));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: assetInfo,
}));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({ sessionSpecFor: spec }));
vi.mock('@/shared/config/marketProfile', () => ({
    getDescriptor: () => ({ priceFormat: { currency: 'USD' } }),
}));

import {
    CONFLUENCE_MIN_BARS,
    evaluateConfluence,
    scoreConfluence,
} from '@y0ngha/siglens-core';
import { getBarsIndicatorsTool } from '@/app/api/ai/chat/tools/getBarsIndicators';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

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
            latest: { rsi: number | null };
        };
        expect(r.bars).toHaveLength(10);
        expect(r.trend).toBe('uptrend');
        expect(r.signals).toEqual([
            { type: 'golden_cross', direction: 'bullish', phase: 'confirmed' },
        ]);
        expect(r.latest.rsi).toBe(2);
        expect(getCachedBars).toHaveBeenCalledWith(
            {},
            'BRK.A',
            '1Day',
            'BRK-A',
            undefined
        );
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
        expect(r.candlePatterns[0]).toEqual({
            date: new Date(detectionWindow[5]!.time * 1000)
                .toISOString()
                .slice(0, 16),
            pattern: 'pattern_5',
        });
        expect(r.candlePatterns[1]).toEqual({
            date: new Date(detectionWindow[6]!.time * 1000)
                .toISOString()
                .slice(0, 16),
            pattern: 'multi_6',
        });
    });

    it('bars:200 처럼 예산을 초과하면 가장 오래된 봉부터 잘라 최신 봉을 보존한다 (item 4)', async () => {
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

    it('confluence: 전체 캐시 봉(요청 bars 아님)으로 core evaluateConfluence를 돌려 압축 형태로 싣는다(HTF 게이트 off)', async () => {
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

        // `evaluateConfluence`/`scoreConfluence` are core's real exports (the
        // module mock spreads `...actual`), so this is the real computation.
        const snapshot = evaluateConfluence(bars, { timeframe: '1Day' });
        expect(snapshot).not.toBeNull();
        expect(snapshot!.bullish.length).toBeGreaterThan(0);
        expect(r.confluence).toEqual({
            score: scoreConfluence(snapshot),
            entryTrigger: snapshot!.entryTrigger,
            exitTrigger: snapshot!.exitTrigger,
            bullish: snapshot!.bullish,
            bearish: snapshot!.bearish,
            freshBullish: snapshot!.freshBullish,
            freshBearish: snapshot!.freshBearish,
            ma50: Number(snapshot!.ma50!.toPrecision(6)),
            htfGate: 'off',
        });
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
});
