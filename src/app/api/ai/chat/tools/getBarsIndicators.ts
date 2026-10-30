import 'server-only';
import { getTranslations } from 'next-intl/server';
import {
    aggregateBarsToWeekly,
    calculateIndicators,
    fearGreedInputs,
    calculateMA,
    classifyMaStack,
    classifyTrend,
    CONFLUENCE_TREND_MA_PERIOD,
    detectCandlePatternEntries,
    detectSignals,
    evaluateConfluence,
    evaluatePullback,
    findMaCrosses,
    pullbackEventCaveat,
    getDetectionBars,
    PULLBACK_BASE_RATES,
    rsiZone,
    scoreConfluence,
    selectLastCandlePatternEntries,
    type Bar,
    type BarsData,
    type BollingerResult,
    type CandlePattern,
    type DMIResult,
    type FearGreedGroupName,
    type FearGreedHistoryPoint,
    type FearGreedLabel,
    type FearGreedSnapshot,
    type IchimokuResult,
    type IndicatorResult,
    type MarketSessionSpec,
    type MaStackDirection,
    type MACDResult,
    type MultiCandlePattern,
    type PullbackReading,
    type PullbackSnapshot,
    type RsiZone,
    type SqueezeMomentumResult,
    type StochasticResult,
    type Timeframe,
    type TrendDirection,
    type TrendState,
} from '@y0ngha/siglens-core';
import { computeSymbolFearGreedSeries } from '@/entities/bars/lib/symbolFearGreed';
import { lastBarIsForming } from '@/entities/bars/lib/quantizeBars';
import { getCachedBarsWithIndicators } from '@/entities/bars/server/barsDataCache';
import {
    roundIndicators,
    roundNumber,
} from '@/entities/bars/lib/roundIndicators';
import { listEarningsDates } from '@/entities/earnings-report/api';
import { marketEventsLookback } from '@/entities/news-article/lib/marketEventsLookback';
import { findMarketEventsForPrompt } from '@/entities/news-article/marketEventsRepository';
import { getDatabaseClient } from '@/shared/db/client';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import type { Locale } from '@/shared/i18n/locales';
import {
    pointBefore,
    scoredHistory,
    THREE_MONTHS_TRADING_DAYS,
    TRADING_DAYS,
    yearScoreExtremes,
} from '@/entities/bars/lib/fearGreedWindow';
import { logToolDegrade } from './logToolDegrade';
import { calendarChangeView, type CalendarChangeView } from './calendarChange';
import { staleKrListingDate } from './freshness';
import { MS_PER_SECOND } from '@/shared/config/time';
import { pctVs, ratioPct } from './percent';
import {
    resolveAssetInfoOrNull,
    resolvedInstrumentFields,
} from './resolveAssetInfo';
import { BARS_RESULT_MAX_CHARS } from './truncate';

/**
 * Restored 20 → 30 (2026-09-14): this tool now fits against its own
 * `BARS_RESULT_MAX_CHARS` (6,500, not the shared `TOOL_RESULT_MAX_CHARS`
 * 4,000) — `fitBarsToBudget`'s trim loop already guarantees that ceiling
 * for any `bars` the model requests, so the default no longer needs to
 * shrink just to keep the common (unbudgeted) case comfortably under 4,000.
 *
 * Measured 2026-10-24 after `derived` gained `closeStreak` and every
 * `RangeWindow` (`range`, `ranges` 20/60 bars) gained the six `*Close` fields:
 * the default 30-bar 1Day request on a production-sized series (500 bars,
 * real indicators, fear & greed, three signals, no MA cross) serializes to
 * ~5,835 chars, untrimmed. During the regular session `lastBarInProgress` +
 * `lastCompletedClose` bring it to ~5,892 — ~608 chars under
 * `BARS_RESULT_MAX_CHARS` (6,500, raised from 6,000 on 2026-10-24 when the
 * headroom was down to ~108), and the "기본 요청(30봉, 1Day)" test pins that
 * larger live-session shape. Re-measure (serialize that test's result, live
 * and non-live) when a top-level or `derived` field is added. Each listed
 * cross adds ~35 chars, so ~17 crosses is what the remaining headroom absorbs
 * before `fitBarsToBudget` starts trimming bars.
 */
const DEFAULT_BARS = 30;
/**
 * The model controls `bars`. `0` would hit the `slice(-0)` trap (JS returns the
 * WHOLE array, not none), and a negative value slices from the wrong end.
 */
const MAX_BARS = 200;

function clampBars(raw: unknown): number {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_BARS;
    return Math.min(Math.max(Math.trunc(raw), 1), MAX_BARS);
}

interface BarPoint {
    t: string;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
}

/**
 * The registry-level `truncateToolResult` (`./truncate.ts`) cuts the
 * SERIALIZED STRING from the front once it exceeds the budget. `bars` is
 * ordered oldest-first and serialized last in the object, so that cut lands
 * on the newest bars first — exactly the ones the model needs most (e.g.
 * `bars: 60` on a symbol with wide MA/EMA/signal payloads). Trim the OLDEST
 * bars here instead, before the object ever reaches that generic truncator,
 * so the newest bar always survives.
 */
function fitBarsToBudget<T extends { bars: BarPoint[] }>(
    buildResult: (bars: BarPoint[], barsTrimmed: number) => T,
    allBars: BarPoint[]
): T {
    let bars = allBars;
    let barsTrimmed = 0;
    // Estimate how many bars the overflow is worth and drop them in one step
    // instead of re-serializing per bar (a few thousand bars would otherwise
    // mean thousands of full serializations). Re-measure and repeat, since the
    // per-bar cost is only an average.
    const MAX_ITERATIONS = 30;
    for (let i = 0; i < MAX_ITERATIONS && bars.length > 1; i++) {
        const serialized = JSON.stringify(buildResult(bars, barsTrimmed));
        const overflow = serialized.length - BARS_RESULT_MAX_CHARS;
        if (overflow <= 0) break;
        const perBar = Math.max(1, Math.ceil(serialized.length / bars.length));
        const drop = Math.min(
            bars.length - 1,
            Math.max(1, Math.ceil(overflow / perBar))
        );
        bars = bars.slice(drop);
        barsTrimmed += drop;
    }
    return buildResult(bars, barsTrimmed);
}

const last = <T>(arr: readonly T[] | undefined): T | null =>
    arr && arr.length > 0 ? arr[arr.length - 1]! : null;

/** Same significant-digit rounding as `roundIndicators`, but null-safe for a value that may be `null`/non-finite. */
const roundOrNull = (v: number | null): number | null =>
    v !== null && Number.isFinite(v) ? roundNumber(v) : null;

/** Picks a compact subset of fields from the latest entry of a per-bar indicator array. Tolerates a missing/empty array. */
function lastPick<T, K extends keyof T>(
    arr: readonly T[] | undefined,
    keys: readonly K[]
): Pick<T, K> | null {
    const item = last(arr);
    if (!item) return null;
    const out = {} as Pick<T, K>;
    for (const k of keys) out[k] = item[k];
    return out;
}

/** Return shape of `latestIndicators` — compact last-value view of every indicator core computes for the series. */
interface LatestIndicatorsView {
    rsi: number | null;
    /**
     * Computed RSI zone (overbought ≥ 70, oversold ≤ 30, else neutral; `null`
     * without an RSI) — the same core `rsiZone` the chart tab and the analysis
     * prompt use. Without it the model labelled e.g. RSI 37.5 "near oversold"
     * while the chart tab called it neutral.
     */
    rsiZone: RsiZone | null;
    macd: MACDResult | null;
    bollinger: BollingerResult | null;
    atr: number | null;
    ma: Record<string, number | null>;
    ema: Record<string, number | null>;
    dmi: Pick<DMIResult, 'adx' | 'diPlus' | 'diMinus'> | null;
    stochastic: Pick<StochasticResult, 'percentK' | 'percentD'> | null;
    cci: number | null;
    mfi: number | null;
    williamsR: number | null;
    vwap: number | null;
    ichimoku: Pick<
        IchimokuResult,
        'tenkan' | 'kijun' | 'senkouA' | 'senkouB'
    > | null;
    supertrend: { value: number | null; trend: TrendDirection } | null;
    parabolicSar: { sar: number | null; trend: TrendDirection } | null;
    squeezeMomentum: Pick<SqueezeMomentumResult, 'momentum' | 'sqzOn'> | null;
    /**
     * RSI(2), 1Day only (`null` elsewhere or below 200 bars). Core computes it
     * inside `evaluatePullback`, not in `IndicatorResult`; it is surfaced here
     * so it survives when the sell-off reading is `none` and `pullback` is null.
     */
    rsi2: number | null;
}

/**
 * Compact last-value view of every indicator core computes for the series —
 * previously only RSI/MACD/Bollinger/ATR/MA/EMA reached the model, leaving
 * ~30 other indicators (DMI, stochastic, CCI, MFI, Williams %R, VWAP,
 * Ichimoku, Supertrend, Parabolic SAR, Squeeze Momentum, ...) invisible.
 */
function latestIndicators(
    ind: IndicatorResult,
    rsi2: number | null
): LatestIndicatorsView {
    const supertrend = last(ind.supertrend);
    const parabolicSar = last(ind.parabolicSar);
    const rsi = last(ind.rsi);
    return {
        rsi,
        rsiZone: rsi !== null && Number.isFinite(rsi) ? rsiZone(rsi) : null,
        macd: last(ind.macd),
        bollinger: last(ind.bollinger),
        atr: last(ind.atr),
        ma: Object.fromEntries(
            Object.entries(ind.ma).map(([p, s]) => [p, last(s)])
        ),
        ema: Object.fromEntries(
            Object.entries(ind.ema).map(([p, s]) => [p, last(s)])
        ),
        dmi: lastPick(ind.dmi, ['adx', 'diPlus', 'diMinus']),
        stochastic: lastPick(ind.stochastic, ['percentK', 'percentD']),
        cci: last(ind.cci),
        mfi: last(ind.mfi),
        williamsR: last(ind.williamsR),
        vwap: last(ind.vwap),
        ichimoku: lastPick(ind.ichimoku, [
            'tenkan',
            'kijun',
            'senkouA',
            'senkouB',
        ]),
        supertrend: supertrend
            ? { value: supertrend.supertrend, trend: supertrend.trend }
            : null,
        parabolicSar: parabolicSar
            ? { sar: parabolicSar.sar, trend: parabolicSar.trend }
            : null,
        squeezeMomentum: lastPick(ind.squeezeMomentum, ['momentum', 'sqzOn']),
        rsi2,
    };
}

/**
 * Bar/candle-pattern/`asOf` timestamps used to be an unmarked-UTC minute
 * string (`YYYY-MM-DDTHH:mm`, no `Z`) even for `1Day` bars, which the model
 * could misread as a local time (spec B2). `1Day` now emits a bare
 * `YYYY-MM-DD` (a day has no time-of-day to misread); intraday emits a full
 * ISO instant WITH `Z` so it is unambiguous.
 */
const isoTimestamp = (unixSeconds: number, timeframe: Timeframe): string => {
    const iso = new Date(unixSeconds * 1000).toISOString();
    return timeframe === '1Day' ? iso.slice(0, 10) : iso;
};

/**
 * Return element of `latestCandlePatterns` — named distinctly from core's
 * `CandlePatternEntry` (which this is derived from but reshapes: a resolved
 * date instead of a window-relative `barIndex`, and a single `pattern`
 * instead of separate `singlePattern`/`multiPattern` fields).
 */
interface BarCandlePattern {
    date: string;
    pattern: CandlePattern | MultiCandlePattern | null;
}

/**
 * Detects candle patterns over the trailing window core scans
 * (`getDetectionBars`), then keeps only the freshest multi-bar + freshest
 * single-bar entry via `selectLastCandlePatternEntries` — the SAME selection
 * the chart markers (`useCandlePatternMarkers.ts`) and the analysis prompt
 * use, so the model sees the same candle semantics as the chart rather than
 * an arbitrary tail slice of the raw detection list. Maps each entry's
 * window-relative `barIndex` back to the bar's date —
 * `detectCandlePatternEntries`' `barIndex` is relative to that window, NOT
 * the full `bars` series.
 */
function latestCandlePatterns(
    bars: Bar[],
    timeframe: Timeframe
): BarCandlePattern[] {
    const detectionBars = getDetectionBars(bars);
    const entries = detectCandlePatternEntries(bars);
    return selectLastCandlePatternEntries(entries).map(entry => ({
        date: isoTimestamp(detectionBars[entry.barIndex]!.time, timeframe),
        pattern: entry.singlePattern ?? entry.multiPattern,
    }));
}

/**
 * Compact view of core's `ConfluenceSnapshot` — drops `timeframe`/`barTime`/`close`
 * (already in the output), `params`, the `entryTrigger`/`exitTrigger` rule states
 * and `htfTrend` (the higher timeframe's trend is already in `higherTimeframe`).
 */
interface BarsConfluenceView {
    score: number;
    bullish: string[];
    bearish: string[];
    freshBullish: string[];
    freshBearish: string[];
    ma50: number | null;
}

/**
 * Rule-based indicator-family confluence (no AI), computed from the full
 * cached series. It is a descriptive tally, not a forecast: siglens-trader
 * retired this rule on 2026-09-24 after its backtests found it
 * indistinguishable from baseline, and on daily bars a met entry rule
 * trailed baseline 10-day returns in every period measured 2000–2026
 * (docs/superpowers/specs/2026-09-25-mean-reversion-evidence-design.md).
 *
 * `htfBars` (loaded once for `higherTimeframe`, §3.1) is threaded into core's
 * own HTF alignment gate when available, so the score's 92 snap matches the
 * trader's gated rule instead of always omitting that clause (spec B3).
 *
 * The rule states themselves are not sent. They went out first as
 * `entryTrigger`/`exitTrigger`, then renamed `entryRuleMet`/`exitRuleMet` so
 * prose would not read them as a buy/sell instruction (spec §3.1) — and the
 * model still wrote "매수, 매도 규칙은 모두 미충족" (2026-10-03). A retired rule
 * with no measured edge is not worth a field the model can misname; when it
 * holds, `scoreConfluence` already snaps the score to 92/8, which carries it.
 * `htfGate` (whether core applied that HTF clause) went with them: only the
 * rule states depended on it, and with no description the model read it as
 * "the 50-bar MA gate".
 *
 * `null` when core abstains (fewer than `CONFLUENCE_MIN_BARS` bars or a
 * non-finite last close) — an abstention, not a neutral 50.
 */
function confluenceView(
    bars: Bar[],
    timeframe: Timeframe,
    htfBars: readonly Bar[] | null,
    htfLabel: string | null
): BarsConfluenceView | null {
    const gateOn = htfBars !== null && htfBars.length > 0;
    const snapshot = evaluateConfluence(bars, {
        timeframe,
        htfBars: gateOn ? htfBars : undefined,
        htfLabel: gateOn ? htfLabel : undefined,
    });
    if (!snapshot) return null;
    return {
        score: scoreConfluence(snapshot),
        bullish: snapshot.bullish,
        bearish: snapshot.bearish,
        freshBullish: snapshot.freshBullish,
        freshBearish: snapshot.freshBearish,
        // Same significant-digit rounding `roundIndicators` applies to `latest`.
        ma50: snapshot.ma50 === null ? null : roundNumber(snapshot.ma50),
    };
}

interface PullbackView {
    reading: Exclude<PullbackReading, 'none'>;
    williamsR: number;
    rsi2: number | null;
    closeVsMa200Pct: number;
    /** The measured exit reference: the sell-off is treated as resolved on the first daily close above it. */
    ma5: number | null;
    /**
     * What the reading has historically meant. Carried in the tool result so the
     * model can quote the base rate instead of inventing one — the grounding
     * check flags numbers no tool returned.
     */
    measured: string;
    /**
     * Event-driven caveat from core's `pullbackEventCaveat` (a sell-off that follows the
     * company's own earnings or a news-driven washout reads differently from a plain
     * pullback), or `null` when none applies — and also when the events/earnings lookup
     * failed (the reading is still valid, just without the caveat).
     */
    caveat: string | null;
}

/**
 * The short-term sell-off reading siglens-trader switched to on 2026-09-24,
 * re-measured on independent data for siglens
 * (docs/superpowers/specs/2026-09-25-mean-reversion-evidence-design.md).
 * Classification, thresholds and base-rate wording all live in core
 * (`evaluatePullback`, `PULLBACK_BASE_RATES`) — the same reading the analysis
 * prompt renders as `### Short-term sell-off check (computed, 1Day bars)`, so the chat and the analysis
 * page cannot drift apart. The field names are the contract core's
 * `get_bars_indicators` tool description promises the model.
 *
 * **Daily only**: the measurement is on daily bars and `evaluatePullback` does
 * not know the timeframe, so the gate is here. Other timeframes get `null`, as
 * does a series core abstains on (fewer than 200 bars, no Williams %R). The
 * snapshot keeps every reading, `none` included — `latest.rsi2` reads it too.
 */
function pullbackSnapshot(
    bars: readonly Bar[],
    timeframe: Timeframe
): PullbackSnapshot | null {
    return timeframe === '1Day' ? evaluatePullback(bars) : null;
}

/**
 * The model-facing sell-off block. **`none` is `null`** (2026-10-03): with a
 * `{reading: 'none', …}` block in hand the model reported it anyway ("워시오프
 * 판독은 없음입니다. Williams %R …") despite the prompt saying to reflect only a
 * lit reading — the same lesson as the confluence rule states: the model cannot
 * mention a field it never gets. RSI(2) survives in `latest.rsi2`.
 */
/**
 * Whether the reading is lit (anything but `none`). One definition shared by the
 * model-facing block and the caveat lookup gate so the two cannot drift apart.
 */
type LitPullbackSnapshot = PullbackSnapshot & {
    reading: Exclude<PullbackReading, 'none'>;
};

function isPullbackLit(
    snap: PullbackSnapshot | null
): snap is LitPullbackSnapshot {
    return snap !== null && snap.reading !== 'none';
}

function pullbackView(
    snap: PullbackSnapshot | null,
    caveat: string | null
): PullbackView | null {
    if (!isPullbackLit(snap)) return null;
    return {
        reading: snap.reading,
        williamsR: roundNumber(snap.williamsR),
        rsi2: roundOrNull(snap.rsi2),
        closeVsMa200Pct: roundNumber(snap.closeVsMa200Pct),
        ma5: roundOrNull(snap.ma5),
        measured: PULLBACK_BASE_RATES[snap.reading],
        caveat,
    };
}

/**
 * Resolves `pullbackEventCaveat` for a lit 1Day reading. Uses the same market-event
 * lookback the analysis path passes to core (`marketEventsLookback`) plus the company's
 * earnings dates. Never throws: a failed lookup must not fail the tool, so it degrades
 * to `null` (no caveat) with a warning.
 */
async function loadPullbackCaveat(
    symbol: string,
    session: MarketSessionSpec,
    bars: readonly Bar[]
): Promise<string | null> {
    try {
        const { db } = getDatabaseClient();
        const [events, earningsDates] = await Promise.all([
            findMarketEventsForPrompt(db, {
                symbol,
                ...marketEventsLookback('1Day', session),
            }),
            listEarningsDates(symbol, db),
        ]);
        return pullbackEventCaveat({ events, earningsDates, bars });
    } catch (error) {
        logToolDegrade('get_bars_indicators', 'pullback caveat', error);
        return null;
    }
}

/** `Timeframe` → the next larger INTRADAY timeframe `get_bars_indicators` loads for `higherTimeframe` (spec §3.1). `1Day`'s higher timeframe is weekly, aggregated from the already-loaded daily bars instead (see `loadHigherTimeframe` below) — no entry here. */
const HTF_MAP: Partial<Record<Timeframe, Timeframe>> = {
    '4Hour': '1Day',
    '1Hour': '4Hour',
    '30Min': '1Hour',
    '15Min': '1Hour',
    '5Min': '30Min',
};

/** `higherTimeframe.timeframe`'s label set — `Timeframe` plus `'1Week'`, which core's `Timeframe` union doesn't carry (weekly bars are a siglens-side aggregation, not a provider-fetched timeframe). */
type HtfTimeframeLabel = Timeframe | '1Week';

interface HigherTimeframeView {
    timeframe: HtfTimeframeLabel;
    trend: TrendState;
    confluenceScore: number | null;
    priceVsMa50Pct: number | null;
    rsi: number | null;
}

/**
 * Loads the next larger timeframe's bars (spec §3.1). `1Day` aggregates the
 * ALREADY-LOADED daily `mainBars` into ISO weeks via core's
 * `aggregateBarsToWeekly` — no second fetch, since the source bars are the
 * same series the main tool call already has in hand — then runs core's
 * `calculateIndicators` on the weekly series (its own warm-up/min-bars
 * handling applies, same as any other timeframe). Every other timeframe
 * fetches its HTF bars via the same cached loader the main series uses.
 * Returns `null` when there is no mapping, the source is empty, or the
 * fetch/aggregation throws (a missing higher timeframe must degrade
 * `higherTimeframe` to null and the confluence HTF clause to off, never fail the whole tool).
 */
async function loadHigherTimeframe(
    provider: ReturnType<typeof getCachedMarketDataProvider>,
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol: string | undefined,
    session: ReturnType<typeof sessionSpecFor>,
    mainBars: readonly Bar[]
): Promise<{
    timeframe: HtfTimeframeLabel;
    bars: Bar[];
    indicators: IndicatorResult;
} | null> {
    if (timeframe === '1Day') {
        try {
            const weeklyBars = aggregateBarsToWeekly(mainBars);
            if (weeklyBars.length === 0) return null;
            return {
                timeframe: '1Week',
                bars: weeklyBars,
                indicators: calculateIndicators(weeklyBars),
            };
        } catch (error) {
            logToolDegrade(
                'get_bars_indicators',
                'weekly higher-timeframe aggregation',
                error
            );
            return null;
        }
    }
    const htfTimeframe = HTF_MAP[timeframe];
    if (!htfTimeframe) return null;
    try {
        const { bars, indicators } = await getCachedBarsWithIndicators(
            provider,
            symbol,
            htfTimeframe,
            fmpSymbol,
            session
        );
        if (bars.length === 0) return null;
        return { timeframe: htfTimeframe, bars, indicators };
    } catch (error) {
        logToolDegrade(
            'get_bars_indicators',
            'higher-timeframe bars fetch',
            error
        );
        return null;
    }
}

/**
 * Compact higher-timeframe read-out (spec §3.1): the next larger timeframe's
 * trend and confluence tally, so the model can say when it disagrees with the
 * requested timeframe. `confluenceScore` is `null` (not core's neutral-50
 * default) when core abstains, per the null rule — a neutral score would
 * read as a real reading here, not an abstention.
 *
 * `priceVsMa50Pct` uses core's own `calculateMA(htf.bars,
 * CONFLUENCE_TREND_MA_PERIOD)` — the SAME MA definition
 * `evaluateConfluence`'s own `ma50` uses internally (replacing a
 * hand-rolled plain-average reimplementation) — INSTEAD OF
 * reading `snapshot?.ma50` directly: `1Day`'s higher timeframe is weekly
 * bars aggregated from the already-loaded daily series, and even the
 * production max of 500 daily bars aggregates to only ~101 weekly bars —
 * well under `CONFLUENCE_MIN_BARS` (120), so `evaluateConfluence` abstains
 * (`snapshot === null`) for every `1Day` request, no matter how much
 * history is loaded. `confluenceScore` staying `null` in that case is
 * honest (core really did abstain), but the same MA is still computable
 * independent of confluence's own bar-count gate, so `priceVsMa50Pct` no
 * longer piggybacks on `snapshot?.ma50`.
 */
function higherTimeframeView(
    htf: {
        timeframe: HtfTimeframeLabel;
        bars: Bar[];
        indicators: IndicatorResult;
    } | null
): HigherTimeframeView | null {
    if (!htf) return null;
    const snapshot = evaluateConfluence(htf.bars, { timeframe: htf.timeframe });
    const lastClose = last(htf.bars.map(b => b.close));
    const ma50 = last(calculateMA(htf.bars, CONFLUENCE_TREND_MA_PERIOD));
    return {
        timeframe: htf.timeframe,
        trend: classifyTrend(htf.bars, htf.indicators),
        confluenceScore: snapshot ? scoreConfluence(snapshot) : null,
        priceVsMa50Pct: pctVs(lastClose, ma50),
        rsi: roundOrNull(last(htf.indicators.rsi)),
    };
}

/**
 * High/low over a window, the bar each was set on, and the last close's
 * distance from each — shared shape for `range` (which also carries `bars`,
 * the window size actually used) and every entry of `ranges`.
 *
 * `highDate`/`lowDate` (dev-2026-10-22 A4): without them a "when was the
 * 52-week low" question had no answer once the low fell outside the returned
 * raw `bars`, and the model borrowed a fear & greed date instead. Same format
 * as the bar timestamps (`YYYY-MM-DD` on 1Day, ISO instant intraday); a tie
 * resolves to the MOST RECENT bar.
 *
 * `high`/`low` are INTRADAY extremes (the bars' high/low). The `*Close`
 * fields are the same window's CLOSING-price extremes ("종가 기준 최고가/최저가")
 * with the same date format, tie rule and distance-from-last-close semantics:
 * a "highest close in 52 weeks" question must read `highClose`, never `high`.
 */
interface RangeWindow {
    high: number | null;
    highDate: string | null;
    low: number | null;
    lowDate: string | null;
    fromHighPct: number | null;
    fromLowPct: number | null;
    highClose: number | null;
    highCloseDate: string | null;
    fromHighClosePct: number | null;
    lowClose: number | null;
    lowCloseDate: string | null;
    fromLowClosePct: number | null;
}

/**
 * Consecutive-close streak ending at the last COMPLETED daily bar, so "며칠
 * 연속 하락" questions need no hand counting. `days` counts consecutive closes
 * moving in `direction` (closes 10,9,8 → down, 2; a single down day after an up
 * day → down, 1). `flat` = the last close equals the previous one; `days` is
 * then the run of unchanged closes. `sinceDate` is the date of the first bar of
 * the streak (the first down day for a down streak).
 *
 * `truncated` is true when the streak runs back to the FIRST loaded bar
 * without a direction change: the real streak may be longer than `days` (and
 * `sinceDate` is only the earliest loaded date), so it must be reported as
 * "at least N days".
 */
interface CloseStreakView {
    direction: 'up' | 'down' | 'flat';
    days: number;
    sinceDate: string;
    truncated: boolean;
}

interface DerivedView {
    lastClose: number | null;
    changePct: {
        '1bar': number | null;
        '5bars': number | null;
        '20bars': number | null;
        '60bars': number | null;
        '252bars': number | null;
    };
    /**
     * Calendar-period returns (1 month / 3 months / 1 year back from the last
     * session's date, base = last session on or before that date), 1Day only —
     * `null` on other timeframes. See `CalendarChangeView` for why these are
     * separate from the bar-count `changePct` keys.
     */
    calendarChange: CalendarChangeView | null;
    range: RangeWindow & { bars: number };
    /**
     * Fixed 20/60-bar high/low windows for ANY timeframe — added after a
     * real-data eval asked "how far below its 60-day high" and got the
     * 52-week `range` high back instead, since `range` is either capped at
     * 252 daily bars or (intraday) every loaded bar, neither of which is a
     * "60-bar high". `null` when fewer than 20 / 60 bars are loaded.
     */
    ranges: {
        '20bars': RangeWindow | null;
        '60bars': RangeWindow | null;
    };
    volumeVsAvg20: number | null;
    atrPct: number | null;
    priceVsMa: Record<string, number | null>;
    maStack: MaStackDirection | null;
    /**
     * 50/200-bar SMA crossings over the last year of daily bars
     * (dev-2026-10-22 A5), oldest first — `[]` when the whole window was
     * checked and none happened. `null` on other timeframes AND when the
     * loaded history is too short to check the whole window (core's
     * `complete: false`): an empty list there would read as "no cross in a
     * year" when the data simply does not reach back that far — the model
     * asserted exactly that for IDXX before this field existed.
     */
    maCross50_200: MaCrossView[] | null;
    /** See {@link CloseStreakView}. `null` off 1Day, with <2 completed bars, or on a non-finite close. */
    closeStreak: CloseStreakView | null;
}

/** One crossing in `derived.maCross50_200`. `kind`: `golden` = MA50 crosses above MA200, `dead` = below. */
interface MaCrossView {
    date: string;
    kind: 'golden' | 'dead';
}

/** SMA periods and window behind `maCross50_200` — the key name is the contract. */
const MA_CROSS_FAST_PERIOD = 50;
const MA_CROSS_SLOW_PERIOD = 200;
const MA_CROSS_LOOKBACK_BARS = 252;

/**
 * Detection is core's (`findMaCrosses`); this only adapts it to the tool
 * shape. Runs on the full cached series, never the trimmed output `bars`.
 */
function maCross50_200View(bars: readonly Bar[]): MaCrossView[] | null {
    const scan = findMaCrosses(
        bars.slice(),
        MA_CROSS_FAST_PERIOD,
        MA_CROSS_SLOW_PERIOD,
        MA_CROSS_LOOKBACK_BARS
    );
    if (!scan.complete) return null;
    return scan.crosses.map(c => ({
        date: isoTimestamp(c.time, '1Day'),
        kind: c.kind,
    }));
}

/**
 * Bars back for each `changePct` key — a fixed bar count, not a calendar
 * day count, for every timeframe (spec §3.1). Named `NbarS` (not `Nd`) —
 * a 1Hour "1d" key previously read as a calendar day when it was actually
 * a 1-BAR change; renamed to avoid that misreading (core's tool description
 * mirrors this contract). `252bars` (dev-2026-10-22 A4) is the 1-year bar
 * count on 1Day; it is `null` unless more than 252 bars are loaded. Calendar
 * periods ("1개월", "작년 이맘때") read `calendarChange`, never these keys.
 */
const CHANGE_PCT_BARS_BACK: Record<keyof DerivedView['changePct'], number> = {
    '1bar': 1,
    '5bars': 5,
    '20bars': 20,
    '60bars': 60,
    '252bars': 252,
};

/** Max daily bars `range` looks back over; intraday uses every loaded bar instead (spec §3.1). */
const RANGE_MAX_DAILY_BARS = 252;

/** Bars back for each `ranges` window — a fixed bar count for every timeframe, same convention as `CHANGE_PCT_BARS_BACK`. */
const RANGES_BARS_BACK: Record<keyof DerivedView['ranges'], number> = {
    '20bars': 20,
    '60bars': 60,
};

/**
 * Period behind `priceVsMa.ma50Pct`. The key name is the contract (core's
 * `get_bars_indicators` description documents `ma50Pct`), so this is its own
 * constant rather than `CONFLUENCE_TREND_MA_PERIOD` — that one is a confluence
 * tuning knob, and retuning it must not silently turn `ma50Pct` into some
 * other period. (`higherTimeframeView`'s `priceVsMa50Pct` deliberately DOES
 * use the confluence constant, to match the gate it explains.)
 */
export const MA50_PERIOD = 50;

/**
 * The bar holding the extreme of `value` over `window`. Only finite values
 * count; `beats` uses `>=`/`<=` so a LATER bar wins a tie (the date is the most
 * recent touch). One helper serves intraday high/low and the close extremes.
 */
function extremeBar(
    window: readonly Bar[],
    value: (bar: Bar) => number,
    beats: (candidate: number, best: number) => boolean
): Bar | null {
    return window.reduce<Bar | null>((best, b) => {
        const v = value(b);
        if (!Number.isFinite(v)) return best;
        return best === null || beats(v, value(best)) ? b : best;
    }, null);
}

/**
 * High/low over `window`, the bar each was set on, and the last close's
 * distance from each. Only finite highs/lows count — a single bad bar
 * (NaN/Infinity from an upstream data glitch) must not poison the whole
 * window's max/min. `>=`/`<=` let a later bar win a tie, so the date is the
 * most recent touch. Shared by `range` (the 252-bar-on-1Day /
 * all-loaded-intraday window) and `ranges` (fixed 20/60-bar windows) so this
 * filtering logic lives once.
 */
function computeRangeWindow(
    window: readonly Bar[],
    lastClose: number | null,
    timeframe: Timeframe
): RangeWindow {
    const highBar = extremeBar(
        window,
        b => b.high,
        (a, best) => a >= best
    );
    const lowBar = extremeBar(
        window,
        b => b.low,
        (a, best) => a <= best
    );
    const highCloseBar = extremeBar(
        window,
        b => b.close,
        (a, best) => a >= best
    );
    const lowCloseBar = extremeBar(
        window,
        b => b.close,
        (a, best) => a <= best
    );
    const high = highBar?.high ?? null;
    const low = lowBar?.low ?? null;
    const highClose = highCloseBar?.close ?? null;
    const lowClose = lowCloseBar?.close ?? null;
    return {
        high,
        highDate: highBar ? isoTimestamp(highBar.time, timeframe) : null,
        low,
        lowDate: lowBar ? isoTimestamp(lowBar.time, timeframe) : null,
        fromHighPct: pctVs(lastClose, high),
        fromLowPct: pctVs(lastClose, low),
        highClose,
        highCloseDate: highCloseBar
            ? isoTimestamp(highCloseBar.time, timeframe)
            : null,
        fromHighClosePct: pctVs(lastClose, highClose),
        lowClose,
        lowCloseDate: lowCloseBar
            ? isoTimestamp(lowCloseBar.time, timeframe)
            : null,
        fromLowClosePct: pctVs(lastClose, lowClose),
    };
}

function directionOf(sign: number): CloseStreakView['direction'] {
    if (sign > 0) return 'up';
    return sign < 0 ? 'down' : 'flat';
}

/**
 * Streak of same-direction closes ending at the last completed daily bar.
 * `lastBarInProgress` drops the forming bar (its "close" is the live price).
 * Scans only the loaded bars; any non-finite close inside the walked run makes
 * the result `null` rather than a silently shortened streak.
 */
function computeCloseStreak(
    bars: readonly Bar[],
    timeframe: Timeframe,
    lastBarInProgress: boolean
): CloseStreakView | null {
    if (timeframe !== '1Day') return null;
    const completed = lastBarInProgress ? bars.slice(0, -1) : bars;
    if (completed.length < 2) return null;
    // moves[j] = direction of the close move INTO bar j + 1 (NaN when either close is non-finite).
    const moves = completed.slice(1).map((b, j) => {
        const diff = b.close - completed[j]!.close;
        return Number.isFinite(diff) ? Math.sign(diff) : Number.NaN;
    });
    const lastMove = moves[moves.length - 1]!;
    if (Number.isNaN(lastMove)) return null;
    // Last move that differs from the final one; -1 = the streak spans every loaded bar.
    const breakIdx = moves.findLastIndex(m => m !== lastMove);
    if (breakIdx >= 0 && Number.isNaN(moves[breakIdx])) return null;
    return {
        direction: directionOf(lastMove),
        days: moves.length - 1 - breakIdx,
        sinceDate: isoTimestamp(completed[breakIdx + 2]!.time, timeframe),
        truncated: breakIdx === -1,
    };
}

/**
 * Values the LLM used to compute itself from raw `bars`/`latest` — returns,
 * 52-week position (plus fixed 20/60-bar high/low windows — `ranges` — for
 * "N-day high/low" questions `range` alone can't answer), volume ratio,
 * MA/EMA distance (plus a fixed 50-bar MA distance — `ma50Pct` — even when
 * 50 isn't one of the caller-configured MA periods), ATR% (spec §3.1, audit
 * B1). Every field follows the null rule (spec §0): computed only when every
 * input is finite and (for a percentage) the base is positive.
 */
function computeDerived(
    bars: readonly Bar[],
    indicators: IndicatorResult,
    timeframe: Timeframe,
    lastBarInProgress: boolean
): DerivedView {
    const lastClose = last(bars.map(b => b.close));
    const changePct = Object.fromEntries(
        Object.entries(CHANGE_PCT_BARS_BACK).map(([key, barsBack]) => {
            const base =
                bars.length > barsBack
                    ? (bars[bars.length - 1 - barsBack]?.close ?? null)
                    : null;
            return [key, pctVs(lastClose, base)];
        })
    ) as DerivedView['changePct'];

    const rangeWindow =
        timeframe === '1Day' ? bars.slice(-RANGE_MAX_DAILY_BARS) : bars;
    const range = {
        ...computeRangeWindow(rangeWindow, lastClose, timeframe),
        bars: rangeWindow.length,
    };

    const ranges = Object.fromEntries(
        Object.entries(RANGES_BARS_BACK).map(([key, n]) => [
            key,
            bars.length >= n
                ? computeRangeWindow(bars.slice(-n), lastClose, timeframe)
                : null,
        ])
    ) as DerivedView['ranges'];

    const prevVolumes = bars.slice(-21, -1).map(b => b.volume);
    const lastVolume = last(bars.map(b => b.volume));
    const avgVolume20 =
        prevVolumes.length === 20 && prevVolumes.every(Number.isFinite)
            ? prevVolumes.reduce((sum, v) => sum + v, 0) / prevVolumes.length
            : null;
    const volumeVsAvg20 =
        lastVolume !== null &&
        Number.isFinite(lastVolume) &&
        avgVolume20 !== null &&
        avgVolume20 > 0
            ? roundNumber(lastVolume / avgVolume20)
            : null;

    // ATR is a ratio OF price (atr / price), not a percent DIFFERENCE from a
    // base like the other `...Pct` fields — `pctVs` would compute
    // `(atr - price) / price` instead.
    const atrPct = ratioPct(last(indicators.atr), lastClose);

    // `calculateMA` needs a mutable array; `bars` stays `readonly` at the
    // param boundary so `.slice()` here is a defensive copy, not a weakened
    // contract.
    const ma50 = last(calculateMA(bars.slice(), MA50_PERIOD));
    const priceVsMa: Record<string, number | null> = {
        // Computed directly (not read from `indicators.ma`, which only
        // carries the caller-configured MA periods and may not include 50)
        // so a 50-bar MA distance is ALWAYS available — spread first so a
        // real `indicators.ma['50']`, if 50 IS one of the configured
        // periods, overwrites this fallback rather than the other way
        // around.
        ma50Pct: pctVs(lastClose, ma50),
        ...Object.fromEntries(
            Object.entries(indicators.ma).map(([period, series]) => [
                `ma${period}Pct`,
                pctVs(lastClose, last(series)),
            ])
        ),
        ...Object.fromEntries(
            Object.entries(indicators.ema).map(([period, series]) => [
                `ema${period}Pct`,
                pctVs(lastClose, last(series)),
            ])
        ),
    };

    const maStack = classifyMaStack(indicators);

    return {
        lastClose,
        changePct,
        calendarChange: timeframe === '1Day' ? calendarChangeView(bars) : null,
        range,
        ranges,
        volumeVsAvg20,
        atrPct,
        priceVsMa,
        maStack,
        maCross50_200: timeframe === '1Day' ? maCross50_200View(bars) : null,
        closeStreak: computeCloseStreak(bars, timeframe, lastBarInProgress),
    };
}

/** One Flow/Trend group of {@link SymbolFearGreedView}. `label` is the name the symbol fear & greed page shows, in the reader's locale. */
interface FearGreedGroupView {
    name: FearGreedGroupName;
    label: string;
    score: number;
}

/** One dated reading of the symbol's own series. */
interface FearGreedHistoryPointView {
    date: string;
    score: number;
    label: FearGreedLabel;
}

/**
 * Where the symbol's index stood earlier — the page's week / month / year
 * comparison plus a three-month point, and the year's low and high. Every
 * field is `null` when the scored series is too short to reach it.
 */
interface FearGreedHistoryView {
    weekAgo: FearGreedHistoryPointView | null;
    monthAgo: FearGreedHistoryPointView | null;
    threeMonthsAgo: FearGreedHistoryPointView | null;
    yearAgo: FearGreedHistoryPointView | null;
    yearMin: { date: string; score: number } | null;
    yearMax: { date: string; score: number } | null;
}

/**
 * `get_bars_indicators`'s `fearGreed` field — the symbol's own index, not the
 * market-wide one. `label`/`confidence` keep core's literal unions rather than
 * widening to `string`: the dashboard's own view type does the same, and a
 * widened field lets a typo through the type checker.
 */
interface SymbolFearGreedView {
    score: number;
    label: FearGreedLabel;
    confidence: FearGreedSnapshot['confidence'];
    groups: FearGreedGroupView[];
    history: FearGreedHistoryView;
}

const GROUP_LABEL_KEY: Record<FearGreedGroupName, string> = {
    Flow: 'groupFlow',
    Trend: 'groupTrend',
};

const GROUP_LABEL_FALLBACK: Record<FearGreedGroupName, string> = {
    Flow: 'Flow',
    Trend: 'Trend',
};

/** Group names as the symbol fear & greed page words them (`views.symbol.fearGreedFacts`). Falls back to the English name so a catalog failure never costs the whole field. */
async function groupLabels(
    locale: Locale
): Promise<Record<FearGreedGroupName, string>> {
    try {
        const t = await getTranslations({
            locale,
            namespace: 'views.symbol.fearGreedFacts',
        });
        return {
            Flow: t(GROUP_LABEL_KEY.Flow),
            Trend: t(GROUP_LABEL_KEY.Trend),
        };
    } catch (error) {
        logToolDegrade('get_bars_indicators', 'group label translation', error);
        return GROUP_LABEL_FALLBACK;
    }
}

/**
 * Week / month / three-month / year comparison points and the year's range
 * from core's history. Built with the page's own helpers (`scoredHistory`,
 * `pointBefore`, `yearScoreExtremes`) so offsets, window and tie rule cannot
 * drift: warm-up points are dropped, extremes are picked on RAW scores, and
 * only the output is rounded.
 */
export function buildFearGreedHistoryView(
    history: readonly FearGreedHistoryPoint[]
): FearGreedHistoryView {
    const scored = scoredHistory(history);
    const before = (back: number): FearGreedHistoryPointView | null => {
        const p = pointBefore(scored, back);
        return p === null ? null : { ...p, score: Math.round(p.score) };
    };
    const extremes = yearScoreExtremes(scored);
    const out = (p: { date: string; score: number } | undefined) =>
        p === undefined ? null : { date: p.date, score: Math.round(p.score) };
    return {
        weekAgo: before(TRADING_DAYS.week),
        monthAgo: before(TRADING_DAYS.month),
        threeMonthsAgo: before(THREE_MONTHS_TRADING_DAYS),
        yearAgo: before(TRADING_DAYS.year),
        yearMin: out(extremes?.min),
        yearMax: out(extremes?.max),
    };
}

/**
 * The symbol's own Fear & Greed reading — the same number `/{symbol}/fear-greed`
 * shows, from the same core functions over the same input the page uses
 * (`fearGreedInputs`: the 5-year daily `fearGreedBars` carried by the cached
 * bars data, falling back to the standard bars). Nothing extra is fetched —
 * the long series arrives with the same daily bars request.
 *
 * **Daily only.** The page pins the index to `1Day` bars by spec, so computing
 * it off a 4-hour or 30-minute series would hand the model a score that no
 * screen shows and that cannot be compared with the one that does. Other
 * timeframes get `null`.
 *
 * `null` also when core abstains — the walk-forward sample is too short for
 * percentiles (a young listing, or a short loaded history).
 */
async function fearGreedView(
    data: BarsData,
    timeframe: Timeframe,
    locale: Locale
): Promise<SymbolFearGreedView | null> {
    if (timeframe !== '1Day') return null;
    // 화면과 같은 입력 선택 — 5년 일봉(`fearGreedBars`)이 있으면 그것으로 계산한다. 2년 봉으로
    // 계산하면 모델이 화면과 다른 점수를 말한다. 화면과 같은 공용 계산(`computeSymbolFearGreedSeries`)을
    // 쓰므로 스냅샷과 history가 한 번에 나온다. history(5년 walk-forward)는 종목당 100ms대라
    // 비싸지만 일봉에서만, 이미 불러온 봉으로 한 번만 계산한다(별도 fetch 없음). route handler라
    // `React.cache` 메모는 없다 — 호출당 한 번이 곧 전부다.
    const { bars, buySellVolume: flow } = fearGreedInputs(data);
    // core는 `buySellVolume`을 봉과 **1:1로 나란한 배열**로 전제하고 인덱스로 읽는다.
    // 짧거나 없는 배열이 들어오면 거기서 throw가 나 도구 전체가 죽는다 — 공포·탐욕
    // 한 필드 때문에 시세·지표 답변을 통째로 잃을 이유는 없다.
    if (!Array.isArray(flow) || flow.length < bars.length) return null;
    const { snapshot, history } = computeSymbolFearGreedSeries([...bars], flow);
    if (!snapshot) return null;
    const labels = await groupLabels(locale);
    return {
        score: snapshot.score,
        label: snapshot.label,
        confidence: snapshot.confidence,
        groups: snapshot.groups.map(g => ({
            name: g.name,
            label: labels[g.name],
            score: Math.round(g.score),
        })),
        history: buildFearGreedHistoryView(history),
    };
}

/**
 * 정규장 중에는 캐시된 봉 끝에 60초 시세 스냅샷으로 만든 오늘 봉이 붙는다. 그 봉의 종가는
 * 현재가일 뿐 종가가 아닌데, 출력에 표시가 없으면 모델이 `asOf` 날짜와 함께 "그날 종가"로 읽는다
 * (2026-10-23 운영, 미국 장중 "VIX 가장 최근 종가" 질문에 진행 중 봉 18.35를 "10월 22일 세션
 * 마감 기준 종가"라고 답함 — 실제 최근 종가는 10/21 16.68). 진행 중이라는 사실과, 일봉이면 직전
 * 완료 세션의 종가·날짜를 함께 실어 "가장 최근 종가" 질문이 그 값을 쓰게 한다. 모델이 두 필드를
 * 읽는 규칙은 core(2.25.2+)의 `get_bars_indicators` 도구 설명에 있다. 동작은 테스트
 * "진행 중인 마지막 봉" 블록이 고정한다.
 */
function lastBarProgress(
    bars: readonly Bar[],
    timeframe: Timeframe,
    session: MarketSessionSpec
): {
    lastBarInProgress: boolean;
    lastCompletedClose?: { date: string; close: number };
} {
    const inProgress = lastBarIsForming(bars, session, new Date());
    const previous = bars.at(-2);
    if (!inProgress || timeframe !== '1Day' || previous === undefined)
        return { lastBarInProgress: inProgress };
    return {
        lastBarInProgress: true,
        lastCompletedClose: {
            date: isoTimestamp(previous.time, timeframe),
            close: previous.close,
        },
    };
}

export const getBarsIndicatorsTool: ToolExecutor = async (args, ctx) => {
    const symbol = String(args.symbol).toUpperCase();
    const timeframe = args.timeframe as Timeframe;
    const count = clampBars(args.bars);
    const [profile, asset] = await Promise.all([
        resolveMarketProfile(symbol),
        // `Promise.all` rejects as soon as ANY promise rejects, so an
        // unwrapped `getAssetInfo` would sink the sibling
        // `resolveMarketProfile` call too and fail bars+indicators outright
        // over a lookup whose only output here is `fmpSymbol`.
        resolveAssetInfoOrNull(symbol, 'get_bars_indicators'),
    ]);
    const session = sessionSpecFor(profile);
    const provider = getCachedMarketDataProvider(session);
    const barsData = await getCachedBarsWithIndicators(
        provider,
        symbol,
        timeframe,
        asset?.fmpSymbol,
        session
    );
    const { bars, indicators } = barsData;
    if (bars.length === 0) return { symbol, timeframe, found: false };
    // 한국의 죽은 리스팅(잘못된 접미사 등)은 묵은 봉을 "현재"로 내보내지 않고 데이터 오류로 돌린다.
    const lastTradeDate = staleKrListingDate(
        profile,
        bars[bars.length - 1]!.time * MS_PER_SECOND,
        Date.now()
    );
    if (lastTradeDate !== null)
        return {
            symbol,
            timeframe,
            found: false,
            error: 'stale_listing',
            lastTradeDate,
        };
    const requestedBars: BarPoint[] = bars.slice(-count).map(b => ({
        t: isoTimestamp(b.time, timeframe),
        o: b.open,
        h: b.high,
        l: b.low,
        c: b.close,
        v: b.volume,
    }));
    const currency = getDescriptor(profile).priceFormat.currency;
    const trend = classifyTrend(bars, indicators);
    const signals = detectSignals(bars, indicators).map(s => ({
        type: s.type,
        direction: s.direction,
        phase: s.phase,
    }));
    // Daily-only and only when a reading is lit — started before the higher-timeframe load
    // so the DB/earnings lookups overlap it instead of adding serial latency. It never
    // rejects (`loadPullbackCaveat` catches), so no unhandled-rejection guard is needed.
    const pullbackSnap = pullbackSnapshot(bars, timeframe);
    const caveatPromise = isPullbackLit(pullbackSnap)
        ? loadPullbackCaveat(symbol, session, bars)
        : Promise.resolve(null);
    const htf = await loadHigherTimeframe(
        provider,
        symbol,
        timeframe,
        asset?.fmpSymbol,
        session,
        bars
    );
    const confluence = confluenceView(
        bars,
        timeframe,
        htf?.bars ?? null,
        htf?.timeframe ?? null
    );
    const higherTimeframe = higherTimeframeView(htf);
    const pullback = pullbackView(pullbackSnap, await caveatPromise);
    const lastBarState = lastBarProgress(bars, timeframe, session);
    const derived = computeDerived(
        bars,
        indicators,
        timeframe,
        lastBarState.lastBarInProgress
    );
    // Client-serialization-boundary rounding only, same as
    // `getBarsAction.ts` — the cache still holds full-precision values.
    const latest = latestIndicators(
        roundIndicators(indicators),
        roundOrNull(pullbackSnap?.rsi2 ?? null)
    );
    const candlePatterns = latestCandlePatterns(bars, timeframe);
    const fearGreed = await fearGreedView(barsData, timeframe, ctx.locale);
    const asOf = isoTimestamp(bars[bars.length - 1]!.time, timeframe);

    return fitBarsToBudget(
        (barsForOutput, barsTrimmed) => ({
            asOf,
            ...lastBarState,
            source: 'SIGLENS bars + indicators',
            symbol,
            ...resolvedInstrumentFields(asset),
            timeframe,
            currency,
            trend,
            signals,
            confluence,
            pullback,
            higherTimeframe,
            derived,
            latest,
            candlePatterns,
            fearGreed,
            barsReturned: barsForOutput.length,
            barsTrimmed,
            bars: barsForOutput,
        }),
        requestedBars
    );
};
