import 'server-only';
import type {
    MarketEvent,
    PriorAnalysis,
    MarketSessionSpec,
    Timeframe,
} from '@y0ngha/siglens-core';
import { DrizzleAnalysisHistoryRepository } from '@/entities/analysis/analysisHistoryRepository';
import { marketEventsLookback } from '@/entities/news-article/lib/marketEventsLookback';
import { findMarketEventsForPrompt } from '@/entities/news-article/marketEventsRepository';
import { resolveHoldingPositionBucket } from '@/entities/portfolio/lib/resolveHoldingPositionBucket';
import type { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDatabaseClient } from '@/shared/db/client';
import { isGuestSubject } from '../guestSubject';

type MarketProfile = Awaited<ReturnType<typeof resolveMarketProfile>>;
type Tier = Parameters<typeof resolveHoldingPositionBucket>[0]['tier'];

/**
 * Member position-bucket hint — the same holding→bucket resolution the
 * analysis SSE route and `get_cached_analysis` use, so a fresh analysis
 * triggered from chat WRITES the same personalized cache key the site reads.
 * Degrades to `undefined` (no holding, guest, or lookup failure) — see
 * `resolveHoldingPositionBucket`'s own JSDoc.
 *
 * Not shared with `get_cached_analysis`'s `positionBucketFor`: that one takes only a symbol and resolves the market
 * profile itself (degrading on failure), while a fresh run already holds the resolved profile.
 */
async function freshRunPositionBucket(
    userId: string,
    tier: Tier,
    symbol: string,
    fmpSymbol: string | undefined,
    profile: MarketProfile,
    logTag: string
): Promise<Awaited<ReturnType<typeof resolveHoldingPositionBucket>>> {
    if (isGuestSubject(userId)) return undefined;
    return resolveHoldingPositionBucket({
        userId,
        tier,
        symbol,
        quoteSymbol: fmpSymbol,
        marketDataProvider: getCachedMarketDataProvider(
            sessionSpecFor(profile)
        ),
        logTag,
    });
}

export interface TechnicalAnalysisInputs {
    readonly session: MarketSessionSpec;
    readonly priorAnalyses: readonly PriorAnalysis[];
    readonly marketEvents: readonly MarketEvent[];
    readonly positionBucket: Awaited<
        ReturnType<typeof resolveHoldingPositionBucket>
    >;
}

/**
 * Task S5 (prior-analysis-context) — same history/events/positionBucket wiring
 * as the SSE route's technical branch and `get_cached_analysis`, so a fresh
 * analysis triggered from chat (or the public API) writes the SAME cache key
 * the site reads/writes.
 *
 * One spec for history, events and core — the history query's
 * `generatedBeforeMs` must sit on the same session boundary core uses to cut
 * the cache-key history.
 */
export async function loadTechnicalAnalysisInputs(input: {
    readonly symbol: string;
    readonly timeframe: Timeframe;
    readonly profile: MarketProfile;
    readonly fmpSymbol: string | undefined;
    readonly userId: string;
    readonly tier: Tier;
    readonly positionBucketLogTag: string;
}): Promise<TechnicalAnalysisInputs> {
    const { symbol, timeframe, profile } = input;
    const historyDb = getDatabaseClient().db;
    const session = sessionSpecFor(profile);
    const [priorAnalyses, marketEvents, positionBucket] = await Promise.all([
        new DrizzleAnalysisHistoryRepository(historyDb).findRecentForPrompt({
            symbol,
            timeframe,
            tab: 'technical',
            session,
        }),
        findMarketEventsForPrompt(historyDb, {
            symbol,
            ...marketEventsLookback(timeframe, session),
        }),
        freshRunPositionBucket(
            input.userId,
            input.tier,
            symbol,
            input.fmpSymbol,
            profile,
            input.positionBucketLogTag
        ),
    ]);
    return { session, priorAnalyses, marketEvents, positionBucket };
}

export interface OverallHistoryInputs {
    readonly technicalPriorAnalyses: readonly PriorAnalysis[];
    readonly overallPriorAnalyses: readonly PriorAnalysis[];
    readonly marketEvents: readonly MarketEvent[];
}

/**
 * Task S5 — same two-array split as the SSE route's overall branch (S2): the
 * technical axis and overall's own top-level `priorAnalyses` read different
 * recency windows (`analysisHistoryQuery`'s axis argument).
 */
export async function loadOverallHistoryInputs(input: {
    readonly symbol: string;
    readonly timeframe: Timeframe;
    readonly profile: MarketProfile;
}): Promise<OverallHistoryInputs> {
    const { symbol, timeframe, profile } = input;
    const overallDb = getDatabaseClient().db;
    const overallHistoryRepo = new DrizzleAnalysisHistoryRepository(overallDb);
    // Same spec `executeOverallAnalysis` hands core as `technical.session`
    // (both derive it from this profile).
    const session = sessionSpecFor(profile);
    const [technicalPriorAnalyses, overallPriorAnalyses, marketEvents] =
        await Promise.all([
            overallHistoryRepo.findRecentForPrompt({
                symbol,
                timeframe,
                tab: 'technical',
                session,
            }),
            overallHistoryRepo.findRecentForPrompt({
                symbol,
                timeframe,
                tab: 'technical',
                axis: 'overall',
                session,
            }),
            findMarketEventsForPrompt(overallDb, {
                symbol,
                ...marketEventsLookback(timeframe, session),
            }),
        ]);
    return { technicalPriorAnalyses, overallPriorAnalyses, marketEvents };
}
