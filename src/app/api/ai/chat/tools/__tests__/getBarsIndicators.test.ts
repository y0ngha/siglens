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
    aggregateBarsToWeekly,
    calculateIndicators,
    calculateMA,
    CONFLUENCE_MIN_BARS,
    CONFLUENCE_TREND_MA_PERIOD,
    evaluateConfluence,
    scoreConfluence,
} from '@y0ngha/siglens-core';
import {
    getBarsIndicatorsTool,
    MA50_PERIOD,
} from '@/app/api/ai/chat/tools/getBarsIndicators';
import { pctVs } from '@/app/api/ai/chat/tools/percent';
import { roundNumber } from '@/entities/bars/lib/roundIndicators';

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

    it('confluence: 전체 캐시 봉(요청 bars 아님)으로 core evaluateConfluence를 돌려 압축 형태로 싣는다(htfGate는 snapshot.htfTrend로 판정)', async () => {
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
        // core's real exports (the module mock spreads `...actual`), so this
        // is the real computation — '1Day's higher timeframe is now the
        // weekly aggregation of the SAME cached daily bars. 150 daily bars
        // aggregate to far fewer weekly bars than core needs to actually
        // apply the HTF gate, so `snapshot.htfTrend` comes back `null` even
        // though `htfBars` WAS supplied — `htfGate` must reflect that real
        // outcome (`snapshot.htfTrend !== null`), not merely "were bars
        // offered".
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
            entryRuleMet: snapshot!.entryTrigger,
            exitRuleMet: snapshot!.exitTrigger,
            bullish: snapshot!.bullish,
            bearish: snapshot!.bearish,
            freshBullish: snapshot!.freshBullish,
            freshBearish: snapshot!.freshBearish,
            ma50: roundNumber(snapshot!.ma50!),
            htfGate: snapshot!.htfTrend !== null ? 'on' : 'off',
        });
    });

    it('confluence: htfBars가 로드되면 htfGate가 on이고 core evaluateConfluence에 htfBars가 전달된다', async () => {
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
        )) as { confluence: { htfGate: string } | null };

        expect(r.confluence?.htfGate).toBe('on');
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
            });
            expect(r.derived.range).toEqual({
                high: 160,
                low: 99,
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
                    low: 139,
                    fromHighPct: roundNumber(((159 - 160) / 160) * 100),
                    fromLowPct: roundNumber(((159 - 139) / 139) * 100),
                },
                '60bars': {
                    high: 160,
                    low: 99,
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
                low: null,
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
                    low: 124,
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
});
