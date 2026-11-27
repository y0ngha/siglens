import 'server-only';
import {
    aggregateBarsToMonthly,
    aggregateBarsToWeekly,
    barPeriodStartSeconds,
    calculateIndicators,
    classifyOscillatorZones,
    fearGreedInputs,
    calculateMA,
    classifyMaStack,
    classifyTrend,
    computeBarChangeStats,
    computeCloseStreak,
    CONFLUENCE_TREND_MA_PERIOD,
    detectCandlePatternEntries,
    detectSignals,
    evaluateConfluence,
    evaluatePullback,
    pullbackEventCaveat,
    getDetectionBars,
    hasUsablePrices,
    PULLBACK_BASE_RATES,
    rsiZone,
    scanLongTermMaCrosses,
    scoreConfluence,
    selectLastCandlePatternEntries,
    type AgentBarsTimeframe,
    type Bar,
    type BarPeriod,
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
    type OscillatorKey,
    type OscillatorZone,
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
import { getTranslations } from 'next-intl/server';
import {
    pointBefore,
    scoredHistory,
    THREE_MONTHS_TRADING_DAYS,
    TRADING_DAYS,
    yearScoreExtremes,
} from '@/entities/bars/lib/fearGreedWindow';
import { pctVs, ratioToPct } from '@/entities/bars/lib/percent';
import { lastBarIsForming } from '@/entities/bars/lib/quantizeBars';
import {
    roundIndicators,
    roundNumber,
} from '@/entities/bars/lib/roundIndicators';
import { computeSymbolFearGreedSeries } from '@/entities/bars/lib/symbolFearGreed';
import { getCachedBarsWithIndicators } from '@/entities/bars/server/barsDataCache';
import { listEarningsDates } from '@/entities/earnings-report/api';
import { marketEventsLookback } from '@/entities/news-article/lib/marketEventsLookback';
import { findMarketEventsForPrompt } from '@/entities/news-article/marketEventsRepository';
import { staleKrListingDate } from '@/entities/ticker/lib/freshness';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import {
    resolveAssetInfoOrNull,
    resolvedInstrumentFields,
} from '@/entities/ticker/server/resolveAssetInfo';
import {
    calendarChangeView,
    type CalendarChangeView,
} from '@/features/agent-tools/lib/calendarChange';
import { chartBlockFrom } from '@/features/agent-tools/lib/chartBlock';
import {
    computeRangeWindow,
    type RangeWindow,
} from '@/features/agent-tools/lib/rangeWindow';
import { BARS_RESULT_MAX_CHARS } from '@/features/agent-tools/lib/truncate';
import type { ToolExecutor } from '@/features/agent-tools/model';
import { BARS_RESULT_NOTES } from '@/features/agent-tools/spec/resultNotes';
import { utcMidnightSeconds } from '@/shared/api/market/barsWindow';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { MS_PER_SECOND, SECONDS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import type { Locale } from '@/shared/i18n/locales';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { logToolDegrade } from '@/shared/lib/logToolDegrade';
import { zonedDate } from '@/shared/lib/marketSessionDate';

/**
 * Default bar count. This tool fits against its own bars cap
 * (`ToolRuntime.barsResultMaxChars`: 7,000 for the agent `BARS_RESULT_MAX_CHARS`
 * and the public API `PUBLIC_API_RESULT_CAPS.bars`, not the shared
 * `TOOL_RESULT_MAX_CHARS` 4,000), and `fitBarsToBudget`'s trim loop guarantees
 * that ceiling for any `bars` the model requests, so the default does not have
 * to shrink to keep the common case under 4,000.
 *
 * Headroom at 30 bars (1Day, production-sized series: 500 bars, real
 * indicators, fear & greed, three signals, no MA cross, in the live
 * regular-session shape `lastBarInProgress` + `lastCompletedClose` that the
 * "기본 요청(30봉, 1Day)" test pins): ~6,155 chars with a typical oscillator
 * tally, ~6,330 with the longest. The tool fits against the calling executor's
 * cap minus `BARS_ANNOTATE_HEADROOM_CHARS` (100) = 6,900, leaving ~745 (~570
 * with the longest tally). Each listed cross adds ~35 chars, so ~16 crosses are
 * what the worst case absorbs before `fitBarsToBudget` starts trimming bars.
 *
 * Result `notes` (`BARS_RESULT_NOTES`, `spec/resultNotes.ts`) appear only where a field is null.
 * Measured at the default 30 bars on production-shaped series (2026-11-21):
 * 1Day with every field present 5,938 (no `notes` key); 1Day with 451 bars
 * (`maCrossShortHistory`, 260 chars) 6,230; 4Hour with `dailyOnlyFields`
 * (~470 chars, the longest note) 6,197; 1Week 5,463. The three 1Day notes
 * (245 + 260 + 235) only meet on a series so short that the rest of the
 * payload is mostly absent. The notes sit inside `fitBarsToBudget`'s builder,
 * so a long request trims bars rather than the note.
 *
 * Re-measure by serializing that test's result when a top-level or `derived`
 * field is added.
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
    allBars: BarPoint[],
    maxChars: number
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
        const overflow = serialized.length - maxChars;
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
    arr?.at(-1) ?? null;

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
    /**
     * Computed zone of RSI, stochastic %K, Williams %R, CCI and MFI (`null` for
     * a reading that is not available), from one core `classifyOscillatorZones`
     * call on the rounded values shown here. The prompt tells the model to
     * quote these instead of calling an oversold/overbought state from RSI alone.
     */
    oscillatorZones: Record<OscillatorKey, OscillatorZone | null>;
    /** One-line tally of `oscillatorZones` (counts and names); `null` when no oscillator reading is available. */
    oscillatorSummary: string | null;
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
    const stochastic = lastPick(ind.stochastic, ['percentK', 'percentD']);
    const cci = last(ind.cci);
    const mfi = last(ind.mfi);
    const williamsR = last(ind.williamsR);
    // A missing reading is `null`, never 0 (0 is a real, neutral value).
    const oscillators = classifyOscillatorZones({
        rsi,
        stochasticK: stochastic?.percentK ?? null,
        williamsR,
        cci,
        mfi,
    });
    return {
        rsi,
        rsiZone: rsi !== null && Number.isFinite(rsi) ? rsiZone(rsi) : null,
        oscillatorZones: oscillators.zones,
        oscillatorSummary: oscillators.summary,
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
        stochastic,
        cci,
        mfi,
        williamsR,
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
const isoTimestamp = (
    unixSeconds: number,
    timeframe: AgentBarsTimeframe
): string => {
    const iso = new Date(unixSeconds * 1000).toISOString();
    return isDailyOrLonger(timeframe) ? iso.slice(0, 10) : iso;
};

/**
 * Weekly and monthly bars are not a provider timeframe: the tool builds them
 * from daily bars (core `aggregateBarsToWeekly` / `aggregateBarsToMonthly`,
 * the same aggregation `higherTimeframe` already uses for 1Day).
 */
type AggregatedTimeframe = Extract<AgentBarsTimeframe, '1Week' | '1Month'>;

function isAggregatedTimeframe(
    timeframe: AgentBarsTimeframe
): timeframe is AggregatedTimeframe {
    return timeframe === '1Week' || timeframe === '1Month';
}

/** Daily bars and anything built from them carry a date, not a time of day. */
function isDailyOrLonger(timeframe: AgentBarsTimeframe): boolean {
    return timeframe === '1Day' || isAggregatedTimeframe(timeframe);
}

const AGGREGATE: Record<AggregatedTimeframe, (bars: readonly Bar[]) => Bar[]> =
    {
        '1Week': aggregateBarsToWeekly,
        '1Month': aggregateBarsToMonthly,
    };

/** The core period each aggregated timeframe's bars are stamped with. */
const PERIOD: Record<AggregatedTimeframe, BarPeriod> = {
    '1Week': 'week',
    '1Month': 'month',
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
    timeframe: AgentBarsTimeframe
): BarCandlePattern[] {
    const detectionBars = getDetectionBars(bars);
    const entries = detectCandlePatternEntries(bars);
    return selectLastCandlePatternEntries(entries).map(entry => {
        const bar = detectionBars[entry.barIndex];
        if (bar === undefined) {
            throw new Error(
                `candle pattern barIndex ${entry.barIndex} is outside the detection window`
            );
        }
        return {
            date: isoTimestamp(bar.time, timeframe),
            pattern: entry.singlePattern ?? entry.multiPattern,
        };
    });
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
 * trailed baseline 10-day returns in every period measured 2000–2026.
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
    timeframe: AgentBarsTimeframe,
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
 * re-measured on independent data for siglens.
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
    timeframe: AgentBarsTimeframe
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

interface HigherTimeframeView {
    timeframe: AgentBarsTimeframe;
    trend: TrendState;
    confluenceScore: number | null;
    priceVsMa50Pct: number | null;
    rsi: number | null;
}

/**
 * Loads the next larger timeframe's bars (spec §3.1). `1Day` aggregates the
 * ALREADY-LOADED long daily series (`longDailyBars`: the five-year
 * `fearGreedBars` when cached, else the regular window) into ISO weeks via
 * core's `aggregateBarsToWeekly`, and `1Week` aggregates the same series into
 * months — no second fetch, and the same daily source a `1Week` request
 * builds its own bars from, so a 1Day call's weekly read and a 1Week call
 * agree. Then it runs core's
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
    timeframe: AgentBarsTimeframe,
    fmpSymbol: string | undefined,
    session: ReturnType<typeof sessionSpecFor>,
    longDailyBars: readonly Bar[] | null
): Promise<{
    timeframe: AgentBarsTimeframe;
    bars: Bar[];
    indicators: IndicatorResult;
} | null> {
    // Weekly → monthly, built from the same daily series as the weekly bars;
    // monthly has no larger timeframe SIGLENS builds.
    if (timeframe === '1Month') return null;
    if (timeframe === '1Week') {
        try {
            if (longDailyBars === null) return null;
            const monthlyBars = aggregateBarsToMonthly(longDailyBars);
            if (monthlyBars.length === 0) return null;
            return {
                timeframe: '1Month',
                bars: monthlyBars,
                indicators: calculateIndicators(monthlyBars),
            };
        } catch (error) {
            logToolDegrade(
                'get_bars_indicators',
                'monthly higher-timeframe aggregation',
                error
            );
            return null;
        }
    }
    if (timeframe === '1Day') {
        try {
            if (longDailyBars === null) return null;
            const weeklyBars = aggregateBarsToWeekly(longDailyBars);
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
 * reading `snapshot?.ma50` directly: whether `evaluateConfluence` abstains
 * on the higher timeframe depends on how many bars it has. `1Day`'s weekly
 * (and `1Week`'s monthly) bars are aggregated from the long daily series —
 * the five-year `fearGreedBars` (~260 weeks, clearing `CONFLUENCE_MIN_BARS`
 * of 120) when cached, else the regular ~500-session window (~101 weeks,
 * below it, so core abstains). Monthly bars (~60) always fall below it.
 * `confluenceScore` stays `null` whenever core abstains (honest), but the
 * MA is computable independent of confluence's bar-count gate, so
 * `priceVsMa50Pct` does not piggyback on `snapshot?.ma50`.
 */
function higherTimeframeView(
    htf: {
        timeframe: AgentBarsTimeframe;
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
 * Consecutive-close streak ending at the last COMPLETED daily bar, so "며칠
 * 연속 하락" questions need no hand counting. `days` counts consecutive closes
 * moving in `direction` (closes 10,9,8 → down, 2; a single down day after an up
 * day → down, 1). `flat` = the last close equals the previous one; `days` is
 * then the run of unchanged closes. `sinceDate` is the date of the first bar
 * whose close moved in `direction` from the close before it (the first down
 * day for a down streak; for `flat`, the second bar at the unchanged level).
 *
 * `truncated` is true when the streak runs back to the FIRST loaded bar
 * without a direction change: the real streak may be longer than `days`, so
 * it must be reported as "at least N days". `sinceDate` is then the SECOND
 * loaded bar (where the first measured move happened), never the first loaded
 * bar, which only supplies the close that move is measured against.
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

/**
 * The scan (50/200-bar SMAs over the last 252 bars, core's
 * `LONG_TERM_MA_CROSS`) is core's `scanLongTermMaCrosses`; this only adapts
 * it to the tool shape. The key name `maCross50_200` is the contract (pinned
 * by a test against `LONG_TERM_MA_CROSS`: a period change forces a key
 * rename). Runs on the full cached series, never the trimmed output `bars`.
 */
function maCross50_200View(bars: readonly Bar[]): MaCrossView[] | null {
    const scan = scanLongTermMaCrosses(bars);
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
 * a 1-BAR change; renamed to avoid that misreading (the tool description in
 * `spec/getBarsIndicators.ts` mirrors this contract). `252bars` (dev-2026-10-22 A4) is the 1-year bar
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
 * Streak of same-direction closes ending at the last completed daily bar:
 * core's `computeCloseStreak` (any non-finite close inside the walked run
 * gives `null` rather than a silently shortened streak), with the first
 * streak bar's time printed as `sinceDate`. `lastBarInProgress` drops the
 * forming bar (its "close" is the live price). Daily only: off 1Day the
 * field is `null` and a `dailyOnlyFields` note explains it.
 */
function closeStreakView(
    bars: readonly Bar[],
    timeframe: AgentBarsTimeframe,
    lastBarInProgress: boolean
): CloseStreakView | null {
    if (timeframe !== '1Day') return null;
    const streak = computeCloseStreak(bars, {
        excludeLastBar: lastBarInProgress,
    });
    if (streak === null) return null;
    return {
        direction: streak.direction,
        days: streak.days,
        sinceDate: isoTimestamp(streak.sinceTime, timeframe),
        truncated: streak.truncated,
    };
}

/**
 * Prefixes a period-keyed distance map (`{ '20': 0.05 }`) into the
 * `priceVsMa` keys (`ma20Pct` / `ema20Pct`) and scales each ratio to a
 * rounded percent. Key order follows the map (ascending periods).
 */
function periodPctEntries(
    prefix: 'ma' | 'ema',
    ratios: Readonly<Record<string, number | null>>
): [string, number | null][] {
    return Object.entries(ratios).map(([period, ratio]) => [
        `${prefix}${period}Pct`,
        ratioToPct(ratio),
    ]);
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
    timeframe: AgentBarsTimeframe,
    lastBarInProgress: boolean
): DerivedView {
    // A partial week or month holds only part of a period's volume, so its
    // ratio to 20 full periods would read as a collapse for days; core then
    // leaves `volumeVsAvg20` null.
    const partialPeriod = isAggregatedTimeframe(timeframe) && lastBarInProgress;
    // Core returns every ratio unrounded and applies the null rule; the
    // percent scale, the significant-digit rounding and the key names
    // below are this tool's contract.
    const stats = computeBarChangeStats(bars, indicators, {
        barsBack: CHANGE_PCT_BARS_BACK,
        partialPeriod,
    });
    const { lastClose, changeRatio } = stats;
    const changePct: DerivedView['changePct'] = {
        '1bar': ratioToPct(changeRatio['1bar']),
        '5bars': ratioToPct(changeRatio['5bars']),
        '20bars': ratioToPct(changeRatio['20bars']),
        '60bars': ratioToPct(changeRatio['60bars']),
        '252bars': ratioToPct(changeRatio['252bars']),
    };

    const formatDate = (unixSeconds: number): string =>
        isoTimestamp(unixSeconds, timeframe);
    const rangeWindow =
        timeframe === '1Day' ? bars.slice(-RANGE_MAX_DAILY_BARS) : bars;
    const range = {
        ...computeRangeWindow(rangeWindow, lastClose, formatDate),
        bars: rangeWindow.length,
    };

    const ranges = Object.fromEntries(
        Object.entries(RANGES_BARS_BACK).map(([key, n]) => [
            key,
            bars.length >= n
                ? computeRangeWindow(bars.slice(-n), lastClose, formatDate)
                : null,
        ])
    ) as DerivedView['ranges'];

    const volumeVsAvg20 =
        stats.volumeVsAvg20 === null ? null : roundNumber(stats.volumeVsAvg20);

    // ATR is a ratio OF price (atr / price), not a percent DIFFERENCE from a
    // base like the other `...Pct` fields; core's `atrRatio` is that ratio.
    const atrPct = ratioToPct(stats.atrRatio);

    const priceVsMa: Record<string, number | null> = {
        // Core computes the 50-bar SMA from `bars` itself (not from
        // `indicators.ma`, which only carries the caller-configured MA
        // periods and may not include 50), so a 50-bar MA distance is ALWAYS
        // available. The key name `ma50Pct` is the contract (core's
        // `get_bars_indicators` description documents it). Spread first so a
        // real `indicators.ma['50']`, if 50 IS one of the configured periods,
        // overwrites this fallback rather than the other way around.
        ma50Pct: ratioToPct(stats.ma50DistanceRatio),
        ...Object.fromEntries(periodPctEntries('ma', stats.maDistanceRatio)),
        ...Object.fromEntries(periodPctEntries('ema', stats.emaDistanceRatio)),
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
        closeStreak: closeStreakView(bars, timeframe, lastBarInProgress),
    };
}

/**
 * `notes` for the result: why a field is null HERE and what the model must do
 * about it (the texts are `BARS_RESULT_NOTES` in `spec/resultNotes.ts`,
 * attached verbatim). The descriptions no longer carry
 * these null rules, so a missing note means the model never sees the rule.
 *
 * - Any timeframe but `1Day`: the daily-only fields are not computed, one note
 *   naming the requested timeframe (weekly and monthly included). The three
 *   notes below are never added next to it: on those timeframes the null is
 *   expected, not a finding about the data.
 * - `1Day`: one note per null field (`closeStreak`, `maCross50_200` when the
 *   252-session scan is incomplete, `fearGreed`). The two scan and ranking
 *   notes do not name a cause: a short history and a failed computation print
 *   the same text, because the executor cannot tell them apart.
 *
 * Empty when nothing applies; the caller then omits the key (no empty array).
 */
function barsResultNotes(
    timeframe: AgentBarsTimeframe,
    derived: DerivedView,
    fearGreed: SymbolFearGreedView | null
): string[] {
    if (timeframe !== '1Day')
        return [BARS_RESULT_NOTES.dailyOnlyFields(timeframe)];
    return [
        ...(derived.closeStreak === null
            ? [BARS_RESULT_NOTES.closeStreakUnavailable]
            : []),
        ...(derived.maCross50_200 === null
            ? [BARS_RESULT_NOTES.maCrossShortHistory]
            : []),
        ...(fearGreed === null ? [BARS_RESULT_NOTES.fearGreedUnavailable] : []),
    ];
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
    timeframe: AgentBarsTimeframe,
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
    timeframe: AgentBarsTimeframe,
    session: MarketSessionSpec,
    longDailyBars: readonly Bar[] | null
): {
    lastBarInProgress: boolean;
    lastCompletedClose?: { date: string; close: number } | null;
} {
    const now = new Date();
    if (isAggregatedTimeframe(timeframe))
        return {
            // `seriesFor` always supplies the daily source for aggregated
            // timeframes; without it nothing can be said, so not in progress
            // (never fall back to the weekly/monthly bars, the wrong granularity).
            lastBarInProgress:
                longDailyBars !== null &&
                aggregatedBarInProgress(
                    bars,
                    timeframe,
                    longDailyBars,
                    session,
                    now
                ),
            // The tool description promises null here: a weekly/monthly read
            // has no single "previous session close".
            lastCompletedClose: null,
        };
    const inProgress = lastBarIsForming(bars, session, now);
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

/**
 * A weekly or monthly bar is unfinished while its period still has trading
 * ahead: the market's own date today (exchange time zone; UTC for 24/7
 * markets) falls in the last bar's period, and either the session is under
 * way, or a trading day of that period has no daily bar yet (today before the
 * open, or a later weekday). A US week read on Saturday, or a Korean week read
 * on Monday 08:00 KST (still Sunday in UTC), is therefore complete or a new
 * week respectively, not "in progress". Exchange holidays are not modelled: a
 * period whose remaining weekdays are all holidays still reads as unfinished
 * until it ends. Period boundaries come from core's `barPeriodStartSeconds`,
 * the same function the aggregators stamp bars with.
 */
function aggregatedBarInProgress(
    bars: readonly Bar[],
    timeframe: AggregatedTimeframe,
    dailyBars: readonly Bar[],
    session: MarketSessionSpec,
    now: Date
): boolean {
    const last = bars.at(-1);
    if (last === undefined) return false;
    const period = PERIOD[timeframe];
    const today = utcMidnightSeconds(
        session.kind === 'always-open'
            ? toUtcIsoDate(now)
            : zonedDate(now, session.timeZone)
    );
    if (barPeriodStartSeconds(period, today) !== last.time) return false;
    if (session.kind === 'always-open') return true;
    if (lastBarIsForming(dailyBars, session, now)) return true;
    const lastDailyTime = dailyBars.at(-1)?.time ?? -Infinity;
    return remainingDaysOfPeriod(period, today).some(
        day =>
            !session.weekendDays.includes(
                new Date(day * MS_PER_SECOND).getUTCDay()
            ) && day > lastDailyTime
    );
}

/**
 * UTC-midnight timestamps from `fromDay` to the last day of the same week or
 * month, inclusive — the days a period still has ahead of it.
 */
function remainingDaysOfPeriod(period: BarPeriod, fromDay: number): number[] {
    const start = barPeriodStartSeconds(period, fromDay);
    // A month has at most 31 days, so the period ends within 31 steps.
    const MAX_PERIOD_DAYS = 31;
    return Array.from(
        { length: MAX_PERIOD_DAYS },
        (_, i) => fromDay + i * SECONDS_PER_DAY
    ).filter(day => barPeriodStartSeconds(period, day) === start);
}

/**
 * The longest daily series the cache holds — the five-year `fearGreedBars`
 * when present, else the regular daily window. Read directly rather than via
 * core's `fearGreedInputs`, which would also compute buy/sell volume over the
 * whole series only to throw it away here.
 */
function longDailyBarsOf(data: BarsData): readonly Bar[] {
    return data.fearGreedBars !== undefined && data.fearGreedBars.length > 0
        ? data.fearGreedBars
        : data.bars;
}

/**
 * The series the tool reads for `timeframe`, plus `longDailyBars` — the daily
 * source weekly and monthly bars are built from (null for intraday, which has
 * no daily history in hand). Provider timeframes use the cached series as
 * loaded. Weekly and monthly are built from {@link longDailyBarsOf} (≈260
 * weeks or 60 months), so a multi-year question reads multi-year bars without
 * another provider call.
 */
function seriesFor(
    data: BarsData,
    timeframe: AgentBarsTimeframe
): {
    bars: Bar[];
    indicators: IndicatorResult;
    longDailyBars: readonly Bar[] | null;
} {
    if (!isAggregatedTimeframe(timeframe))
        return {
            bars: data.bars,
            indicators: data.indicators,
            longDailyBars: timeframe === '1Day' ? longDailyBarsOf(data) : null,
        };
    const longDailyBars = longDailyBarsOf(data);
    const bars = AGGREGATE[timeframe](longDailyBars);
    return { bars, indicators: calculateIndicators(bars), longDailyBars };
}

export const getBarsIndicatorsTool: ToolExecutor = async (
    args,
    ctx,
    runtime
) => {
    const symbol = String(args.symbol).toUpperCase();
    const timeframe = args.timeframe as AgentBarsTimeframe;
    // Weekly and monthly bars are aggregated from the daily series.
    const sourceTimeframe: Timeframe = isAggregatedTimeframe(timeframe)
        ? '1Day'
        : timeframe;
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
        sourceTimeframe,
        asset?.fmpSymbol,
        session
    );
    const latestRawBar = barsData.bars.at(-1);
    if (latestRawBar === undefined) return { symbol, timeframe, found: false };
    // 한국의 죽은 리스팅(잘못된 접미사 등)은 묵은 봉을 "현재"로 내보내지 않고 데이터 오류로 돌린다.
    const lastTradeDate = staleKrListingDate(
        profile,
        latestRawBar.time * MS_PER_SECOND,
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
    const { bars, indicators, longDailyBars } = seriesFor(barsData, timeframe);
    const latestBar = bars.at(-1);
    if (latestBar === undefined) return { symbol, timeframe, found: false };
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
        longDailyBars
    );
    const confluence = confluenceView(
        bars,
        timeframe,
        htf?.bars ?? null,
        htf?.timeframe ?? null
    );
    const higherTimeframe = higherTimeframeView(htf);
    const pullback = pullbackView(pullbackSnap, await caveatPromise);
    const lastBarState = lastBarProgress(
        bars,
        timeframe,
        session,
        longDailyBars
    );
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
    // 봉 차트(작도 없음) — 이 도구가 지금 쓴 봉 그대로라 조회가 더 없다.
    runtime.emitChart?.(
        Promise.resolve(
            chartBlockFrom({
                symbol,
                timeframe,
                marketProfile: profile,
                bars,
            })
        )
    );
    const fearGreed = await fearGreedView(barsData, timeframe, ctx.locale);
    // Weekly/monthly bars are stamped with their period's first day; `asOf` is
    // the last daily bar the aggregation actually used (rows without usable
    // prices are skipped by it, so a trailing placeholder must not date it).
    const asOfTime =
        isAggregatedTimeframe(timeframe) && longDailyBars !== null
            ? (longDailyBars.findLast(hasUsablePrices)?.time ?? latestBar.time)
            : latestBar.time;
    const asOf = isoTimestamp(asOfTime, timeframe);
    const notes = barsResultNotes(timeframe, derived, fearGreed);

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
            // Inside the builder so the fit counts it; absent (never `[]`) when no note applies.
            ...(notes.length > 0 && { notes }),
            barsReturned: barsForOutput.length,
            barsTrimmed,
            bars: barsForOutput,
        }),
        requestedBars,
        // The calling executor's cap (agent or public API); see `ToolRuntime.barsResultMaxChars`.
        runtime.barsResultMaxChars ?? BARS_RESULT_MAX_CHARS
    );
};
