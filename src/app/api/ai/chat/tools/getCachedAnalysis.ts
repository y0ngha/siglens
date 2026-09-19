import 'server-only';
import {
    buildPlanCheck,
    peekAnalysisCache,
    peekOverallAnalysisCache,
    planEntryPrice,
    TIER_CONFIG,
    type ActionRecommendation,
    type AnalysisResponse,
    type FilteredAnalysisResponse,
    type KeyLevel,
    type KeyLevels,
    type Timeframe,
} from '@y0ngha/siglens-core';
import {
    DrizzleAnalysisHistoryRepository,
    type AnalysisHistoryTab,
} from '@/entities/analysis/analysisHistoryRepository';
import { getCachedBarsWithIndicators } from '@/entities/bars/lib/barsDataCache';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { quoteWithTimeout } from '@/shared/api/market/quoteTimeout';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { MS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { resolvePositionBucket } from '@/shared/lib/byokGate';
import { isGuestSubject } from '../guestSubject';
import type { ToolExecutor } from './index';
import { logToolDegrade } from './logToolDegrade';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { pctVs } from './percent';
import {
    fitTechnicalAnalysis,
    projectTechnicalAnalysis,
} from './projectTechnicalAnalysis';
import { resolveAssetInfoOrNull } from './resolveAssetInfo';

const STALE_AFTER_MS: Record<string, number> = {
    technical: MS_PER_DAY,
    overall: MS_PER_DAY,
};
const DEFAULT_STALE_MS = 7 * MS_PER_DAY;
const DEFAULT_TIMEFRAME: Timeframe = '1Day';
const isHistoryTab = (tab: string): tab is AnalysisHistoryTab =>
    tab === 'technical' || tab === 'overall';
/** Age-only fallback rule — used when bar-based staleness (below) can't load bars. */
const stale = (tab: string, generatedAt: Date): boolean =>
    Date.now() - generatedAt.getTime() >
    (STALE_AFTER_MS[tab] ?? DEFAULT_STALE_MS);

/**
 * Bar-count-based staleness (spec §3.2, audit B4): a fixed 24h rule refreshed
 * for nothing over a weekend and never caught up on an intraday timeframe
 * where 24h of bars is dozens of candles. Stale once at least this many bars
 * newer than `generatedAt` have printed, or once age exceeds the 7-day hard
 * cap regardless of bar count (a market that never opened again should still
 * eventually be flagged as old).
 */
const STALE_NEW_BARS: Record<Timeframe, number> = {
    '1Day': 1,
    '4Hour': 2,
    '1Hour': 4,
    '30Min': 4,
    '15Min': 6,
    '5Min': 12,
};
const STALE_HARD_CAP_MS = 7 * MS_PER_DAY;

/** A daily bar's trading date — FMP/Yahoo stamp a `1Day` bar at UTC midnight of the trading date it represents, so the bar's OWN date is just its UTC calendar date. */
function barTradingDateUtc(timeSec: number): string {
    return new Date(timeSec * 1000).toISOString().slice(0, 10);
}

/**
 * Bar-based staleness with a graceful fallback to the old age-only rule when
 * bars cannot be loaded, or load but come back empty (spec §3.2) — a
 * bars-cache outage (or an empty series, which behaves the same as one for
 * this purpose) must degrade the freshness read-out, never break the whole
 * tool call.
 *
 * `1Day` compares TRADING DATES, not raw instants. FMP/Yahoo stamp a daily
 * bar at UTC midnight of the trading date it represents — a stable
 * per-provider convention, not a real intraday timestamp. An analysis
 * generated in the market's own evening (e.g. 21:30 ET, which is already
 * 01:30Z the next UTC day) is still "today" on the exchange's calendar even
 * though UTC has rolled over, so comparing raw instants (`b.time >
 * generatedAtSec`) undercounts newer bars in that window — the very next
 * trading day's bar (stamped at that day's UTC midnight) can read as NOT
 * newer than a `generatedAt` that is, in UTC terms, later in the clock but
 * earlier on the exchange's calendar. Comparing the bar's UTC date against
 * `generatedAt`'s calendar date in the MARKET's own timezone (ET for
 * us-equity, KST for kr-equity, UTC for always-open crypto — from the same
 * `session` this function already resolves) fixes both directions of the
 * error. Intraday timeframes keep the original instant comparison — there is
 * no calendar-date ambiguity to correct there.
 */
async function isStaleByBars(
    tab: string,
    timeframe: Timeframe,
    generatedAt: Date,
    symbol: string,
    fmpSymbol: string | undefined
): Promise<boolean> {
    if (Date.now() - generatedAt.getTime() > STALE_HARD_CAP_MS) return true;
    try {
        const marketProfile = await resolveMarketProfile(symbol);
        const session = sessionSpecFor(marketProfile);
        const { bars } = await getCachedBarsWithIndicators(
            getCachedMarketDataProvider(session),
            symbol,
            timeframe,
            fmpSymbol,
            session
        );
        if (bars.length === 0) return stale(tab, generatedAt);
        if (timeframe === '1Day') {
            const timeZone =
                session.kind === 'scheduled' ? session.timeZone : 'UTC';
            const analysisDate = zonedDate(generatedAt, timeZone);
            const newerBars = bars.filter(
                b => barTradingDateUtc(b.time) > analysisDate
            ).length;
            return newerBars >= STALE_NEW_BARS['1Day'];
        }
        const generatedAtSec = generatedAt.getTime() / 1000;
        const newerBars = bars.filter(b => b.time > generatedAtSec).length;
        return newerBars >= STALE_NEW_BARS[timeframe];
    } catch (error) {
        logToolDegrade('get_cached_analysis', 'stale-by-bars check', error);
        return stale(tab, generatedAt);
    }
}

/**
 * Personalised cache key: the user's holding (avg price) vs current quote →
 * position bucket, as the symbol page does.
 *
 * Degrades to `undefined` (no bucket, i.e. shared/base analysis) on ANY
 * failure or timeout — a holding-read or price-read error must never block
 * returning the underlying cached analysis. Mirrors
 * `resolveHoldingPositionBucket` in `src/app/api/analysis/stream/route.ts`.
 */
async function positionBucketFor(
    userId: string,
    tier: Parameters<typeof resolvePositionBucket>[0],
    symbol: string
) {
    try {
        const holding = await new DrizzlePortfolioRepository(
            getDatabaseClient().db
        ).findByUserAndSymbol(userId, symbol);
        if (!holding) return undefined;
        const profile = await resolveMarketProfile(symbol);
        const quote = await quoteWithTimeout(
            getCachedMarketDataProvider(sessionSpecFor(profile)),
            holding.fmpSymbol ?? symbol
        );
        return resolvePositionBucket(
            tier,
            Number(holding.averagePrice),
            quote?.price ?? null
        );
    } catch (err) {
        console.error(
            '[AgentTool] get_cached_analysis position bucket resolution failed, degrading to no-bucket:',
            err instanceof Error ? err.name : 'unknown'
        );
        return undefined;
    }
}

/** `sessionSpecFor(await resolveMarketProfile(symbol))`, degrading to `undefined` on ANY failure — extracted so the caller can bind it with `const`, not a mutated `let`. */
async function resolveSessionOrUndefined(
    symbol: string
): Promise<ReturnType<typeof sessionSpecFor> | undefined> {
    try {
        return sessionSpecFor(await resolveMarketProfile(symbol));
    } catch (error) {
        logToolDegrade(
            'get_cached_analysis',
            'market profile resolution',
            error
        );
        return undefined;
    }
}

/**
 * Current price for `sinceAnalysis` (spec §3.2): a quote first, falling back
 * to the last close of the same cached bars series `get_bars_indicators`
 * reads — "quote or last close" per spec. `null` on any failure (a stale
 * check on the underlying analysis must never fail the tool call).
 */
async function priceNowFor(
    symbol: string,
    fmpSymbol: string | undefined
): Promise<number | null> {
    const session = await resolveSessionOrUndefined(symbol);
    try {
        const quote = await quoteWithTimeout(
            getCachedMarketDataProvider(session),
            fmpSymbol ?? symbol
        );
        // A failed lookup is `null`; a zero/negative price is bad upstream
        // data — both mean "unknown", never a real price.
        if (quote && Number.isFinite(quote.price) && quote.price > 0)
            return quote.price;
    } catch (error) {
        logToolDegrade('get_cached_analysis', 'quote lookup', error);
        // fall through to last close
    }
    try {
        const { bars } = await getCachedBarsWithIndicators(
            getCachedMarketDataProvider(session),
            symbol,
            DEFAULT_TIMEFRAME,
            fmpSymbol,
            session
        );
        const lastClose = bars.at(-1)?.close;
        return lastClose !== undefined &&
            Number.isFinite(lastClose) &&
            lastClose > 0
            ? lastClose
            : null;
    } catch (error) {
        logToolDegrade('get_cached_analysis', 'last-close lookup', error);
        return null;
    }
}

/** A price level is usable only if it's a real, positive price — a `0`/negative/non-finite level (bad upstream data) must never enter a "nearest"/"broken" computation. */
const isValidLevel = (l: KeyLevel): boolean =>
    Number.isFinite(l.price) && l.price > 0;

/**
 * Nearest SUPPORT at or below `priceNow` (the highest such level) — a
 * support price that price has already broken ABOVE must never be reported
 * as "nearest support" (it reads as a floor still under price). `null` when
 * no valid support sits at/below `priceNow`.
 *
 * `distancePct` follows core's own convention: `(level − price) / price`,
 * so a level ABOVE price is positive and one BELOW is negative — computed
 * via `pctVs(level, price)`, never `pctVs(price, level)` (the inverse sign).
 */
function nearestSupportBelow(
    levels: readonly KeyLevel[] | undefined,
    priceNow: number
): { price: number; distancePct: number } | null {
    const candidates = (levels ?? []).filter(
        l => isValidLevel(l) && l.price <= priceNow
    );
    if (candidates.length === 0) return null;
    const nearest = candidates.reduce((best, l) =>
        l.price > best.price ? l : best
    );
    const distancePct = pctVs(nearest.price, priceNow);
    return distancePct === null ? null : { price: nearest.price, distancePct };
}

/** Nearest RESISTANCE at or above `priceNow` (the lowest such level) — mirrors `nearestSupportBelow`, same `distancePct` convention. */
function nearestResistanceAbove(
    levels: readonly KeyLevel[] | undefined,
    priceNow: number
): { price: number; distancePct: number } | null {
    const candidates = (levels ?? []).filter(
        l => isValidLevel(l) && l.price >= priceNow
    );
    if (candidates.length === 0) return null;
    const nearest = candidates.reduce((best, l) =>
        l.price < best.price ? l : best
    );
    const distancePct = pctVs(nearest.price, priceNow);
    return distancePct === null ? null : { price: nearest.price, distancePct };
}

/** Support levels the price has fallen through / resistance levels it has broken above, since the analysis was generated. */
function levelsBrokenFrom(
    keyLevels: KeyLevels | null | undefined,
    priceNow: number
): Array<{ kind: 'support' | 'resistance'; price: number }> {
    if (!keyLevels) return [];
    const brokenSupport = (keyLevels.support ?? [])
        .filter(l => isValidLevel(l) && priceNow < l.price)
        .map(l => ({ kind: 'support' as const, price: l.price }));
    const brokenResistance = (keyLevels.resistance ?? [])
        .filter(l => isValidLevel(l) && priceNow > l.price)
        .map(l => ({ kind: 'resistance' as const, price: l.price }));
    return [...brokenSupport, ...brokenResistance];
}

export interface SinceAnalysis {
    analysisPrice: number | null;
    priceNow: number;
    movePct: number | null;
    levelsBroken: Array<{ kind: 'support' | 'resistance'; price: number }>;
    nearestSupport: { price: number; distancePct: number } | null;
    nearestResistance: { price: number; distancePct: number } | null;
    planNow: {
        riskReward: number | null;
        belowStopLoss: boolean;
        exceedsEntryZone: boolean;
    } | null;
}

/**
 * "Has the analysis's own view of price moved since it was generated?"
 * (spec §3.2, audit B4) — `undefined` when no current price is reachable
 * (neither a quote nor a last close), per the null rule (spec §0): a
 * `sinceAnalysis` block with every field `null` would look like a real
 * reading rather than an unavailable one. `priceNow` is resolved by the
 * caller: only AFTER a confirmed redis cache hit (never on a miss, which
 * would waste the lookup), and in parallel with `isStaleByBars` there —
 * both are independent bounded lookups, so a technical peek never pays two
 * sequential worst-case waits.
 */
function sinceAnalysisFrom(
    a: AnalysisResponse | FilteredAnalysisResponse,
    priceNow: number | null
): SinceAnalysis | undefined {
    if (priceNow === null) return undefined;
    const analysisPrice =
        a.actionRecommendation?.planCheck?.currentPrice ?? null;
    // `FilteredActionRecommendation` only narrows the four PROSE fields
    // (positionAnalysis/entry/exit/riskReward) to `string | null` —
    // `entryPrices`/`stopLoss`/`takeProfitPrices`/`reconciledLevels`, the
    // only fields `buildPlanCheck` reads, are unchanged from
    // `ActionRecommendation`. Safe to treat as one for this call.
    const rec = (a.actionRecommendation ?? null) as ActionRecommendation | null;
    const planCheck = rec
        ? buildPlanCheck(rec, priceNow, planEntryPrice(rec, analysisPrice))
        : null;
    return {
        analysisPrice,
        priceNow,
        movePct: pctVs(priceNow, analysisPrice),
        levelsBroken: levelsBrokenFrom(a.keyLevels, priceNow),
        nearestSupport: nearestSupportBelow(a.keyLevels?.support, priceNow),
        nearestResistance: nearestResistanceAbove(
            a.keyLevels?.resistance,
            priceNow
        ),
        planNow: planCheck
            ? {
                  riskReward: planCheck.riskRewardAtCurrent,
                  belowStopLoss: planCheck.belowStopLoss,
                  exceedsEntryZone: planCheck.exceedsEntryZone,
              }
            : null,
    };
}

/** Redis peek (technical/overall) → SEO snapshot (all tabs) → history digest (technical/overall). */
export const getCachedAnalysisTool: ToolExecutor = async (
    args,
    ctx,
    runtime
) => {
    const symbol = String(args.symbol).toUpperCase();
    const tab = String(args.tab);
    const timeframe =
        (args.timeframe as Timeframe | undefined) ?? DEFAULT_TIMEFRAME;
    // Same symbol→fmpSymbol path `get_bars_indicators`/`get_quote` use — a
    // canonical symbol that differs from what the provider expects (e.g.
    // indices) must resolve the same fmpSymbol here too, for both the bars
    // read (staleness) and the quote read (`sinceAnalysis`'s `priceNow`).
    // Only technical/overall need it — skip the extra DB round-trip for
    // every other tab (fundamental/news/snapshot/history fallbacks).
    const fmpSymbol =
        tab === 'technical' || tab === 'overall'
            ? (await resolveAssetInfoOrNull(symbol, 'get_cached_analysis'))
                  ?.fmpSymbol
            : undefined;

    if (tab === 'technical') {
        // A guest holds nothing, and its subject is not a user id the holdings
        // table could even compare against (uuid column).
        const positionBucket = isGuestSubject(ctx.userId)
            ? undefined
            : await positionBucketFor(ctx.userId, ctx.tier, symbol);
        const cached = await peekAnalysisCache(
            symbol,
            timeframe,
            undefined,
            runtime.analysisModel,
            false,
            ctx.tier,
            TIER_CONFIG,
            positionBucket
        );
        if (cached) {
            const a = cached.result;
            const generatedAt = a.analyzedAt
                ? new Date(a.analyzedAt)
                : new Date();
            // Both started only NOW (a confirmed cache hit) — on a miss,
            // nothing below this `if` ever fires, so starting either eagerly
            // (as `priceNowFor` used to, in parallel with
            // `positionBucketFor` above) paid for a quote/bars lookup on
            // every miss for no reason. Run in parallel with each other
            // instead, since both are independent lookups with their own
            // bounded timeout.
            const [isStale, priceNow] = await Promise.all([
                isStaleByBars(tab, timeframe, generatedAt, symbol, fmpSymbol),
                priceNowFor(symbol, fmpSymbol),
            ]);
            const sinceAnalysis = sinceAnalysisFrom(a, priceNow);
            // Budget-fit via the SAME shared helper `run_fresh_analysis`
            // uses (`fitTechnicalAnalysis`) — without it, an oversized
            // `patterns`/`candlePatterns`/`strategies` slice would fall
            // through to the registry-level `truncateToolResult`, which
            // collapses the WHOLE payload into a front-cut preview blob
            // (losing `keyLevels`/`priceTargets` too).
            return fitTechnicalAnalysis({
                found: true,
                source: 'redis',
                tab,
                timeframe,
                generatedAt: generatedAt.toISOString(),
                stale: isStale,
                personalized: positionBucket !== undefined,
                analysis: projectTechnicalAnalysis(a),
                ...(sinceAnalysis ? { sinceAnalysis } : {}),
            });
        }
    }
    if (tab === 'overall') {
        // `_companyName` is accepted for call-site symmetry with the overall
        // submit inputs only — core's peek key is not scoped by it and the
        // synthesized narrative doesn't echo it back, so passing `symbol`
        // costs nothing and avoids an extra `getAssetInfo` DB round-trip
        // whose only output (the company name) core ignores here.
        const cached = await peekOverallAnalysisCache(
            symbol,
            symbol,
            timeframe,
            runtime.analysisModel,
            false,
            ctx.tier
        );
        if (cached) {
            // `OverallAnalysisResponse.analyzedAt` (spec §2.5) — optional so
            // a cache entry written before this field existed still reads as
            // "freshness unknown" (`generatedAt: null`) rather than a type
            // error or a fabricated timestamp.
            const generatedAt = cached.analyzedAt
                ? new Date(cached.analyzedAt)
                : null;
            const isStale = generatedAt
                ? await isStaleByBars(
                      tab,
                      timeframe,
                      generatedAt,
                      symbol,
                      fmpSymbol
                  )
                : null;
            return {
                found: true,
                source: 'redis',
                tab,
                timeframe,
                // `null` = "freshness unknown" (no `analyzedAt` yet on this
                // cache entry), not "just generated".
                generatedAt: generatedAt ? generatedAt.toISOString() : null,
                stale: isStale,
                analysis: {
                    headline: cached.headlineKo,
                    technical: cached.technicalBulletsKo,
                    fundamental: cached.fundamentalBulletsKo,
                    news: cached.newsBulletsKo,
                    options: cached.optionsBulletsKo,
                    conclusion: cached.integratedConclusionKo,
                    scenarios: cached.scenarios,
                    risks: cached.riskFactorsKo,
                },
            };
        }
    }
    const { db } = getDatabaseClient();
    const snapshot =
        // Any language: the model answers in the user's language regardless of
        // what the analysis was written in (verified on Korean snapshots with
        // en/ja/zh questions), so the freshest row per tab wins in any language
        // and a Japanese-only row still beats a fresh run.
        (
            await new DrizzleSeoSnapshotRepository(db).findBySymbol(
                symbol,
                ctx.locale,
                { anyLocale: true }
            )
        ).find(s => s.tab === tab);
    if (snapshot) {
        return {
            found: true,
            source: 'snapshot',
            tab,
            generatedAt: snapshot.generatedAt.toISOString(),
            // Bar-based staleness for technical/overall (same rule the redis
            // branches above use) — every other tab has no price bars to
            // compare against, so it keeps the age-only rule.
            stale: isHistoryTab(tab)
                ? await isStaleByBars(
                      tab,
                      timeframe,
                      snapshot.generatedAt,
                      symbol,
                      fmpSymbol
                  )
                : stale(tab, snapshot.generatedAt),
            model: snapshot.model,
            contentLanguage: snapshot.locale,
            // Analysis first, plain rewrite second: if the payload ever outgrows
            // its budget, the cut lands on the paraphrase, not the source.
            analysis: snapshot.content,
            plain: snapshot.plain,
        };
    }
    if (isHistoryTab(tab)) {
        const [latest] = await new DrizzleAnalysisHistoryRepository(
            db
        ).findRecentForPrompt({ symbol, timeframe, tab });
        if (latest)
            return {
                found: true,
                source: 'history',
                tab,
                timeframe,
                generatedAt: latest.generatedAt.toISOString(),
                // `isHistoryTab` already restricts this branch to
                // technical/overall — same bar-based staleness as the redis
                // and snapshot branches above.
                stale: await isStaleByBars(
                    tab,
                    timeframe,
                    latest.generatedAt,
                    symbol,
                    fmpSymbol
                ),
                digest: latest,
            };
    }
    return { found: false, tab, symbol, hint: 'call run_fresh_analysis' };
};
