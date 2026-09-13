import 'server-only';
import {
    peekAnalysisCache,
    peekOverallAnalysisCache,
    TIER_CONFIG,
    type Timeframe,
} from '@y0ngha/siglens-core';
import {
    DrizzleAnalysisHistoryRepository,
    type AnalysisHistoryTab,
} from '@/entities/analysis/analysisHistoryRepository';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { MS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { resolvePositionBucket } from '@/shared/lib/byokGate';
import type { ToolExecutor } from './index';

const STALE_AFTER_MS: Record<string, number> = {
    technical: MS_PER_DAY,
    overall: MS_PER_DAY,
};
const DEFAULT_STALE_MS = 7 * MS_PER_DAY;
const DEFAULT_TIMEFRAME: Timeframe = '1Day';
const isHistoryTab = (tab: string): tab is AnalysisHistoryTab =>
    tab === 'technical' || tab === 'overall';
const stale = (tab: string, generatedAt: Date): boolean =>
    Date.now() - generatedAt.getTime() >
    (STALE_AFTER_MS[tab] ?? DEFAULT_STALE_MS);

/**
 * Mirrors `QUOTE_LOOKUP_TIMEOUT_MS` in `src/app/api/analysis/stream/route.ts`
 * (~line 179) — not exported from there, so kept as a local literal. FMP 429
 * storms can push a single `getQuote` call to ~85s (10s request timeout +
 * 10/15/20s backoff); personalization is a nice-to-have, never a precondition
 * for returning the underlying cached analysis, so this must stay short.
 */
const QUOTE_LOOKUP_TIMEOUT_MS = 5_000;

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
        const quote = await Promise.race([
            getCachedMarketDataProvider(sessionSpecFor(profile)).getQuote(
                holding.fmpSymbol ?? symbol
            ),
            new Promise<null>(resolve => {
                setTimeout(
                    () => resolve(null),
                    QUOTE_LOOKUP_TIMEOUT_MS
                ).unref();
            }),
        ]);
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

    if (tab === 'technical') {
        const positionBucket = await positionBucketFor(
            ctx.userId,
            ctx.tier,
            symbol
        );
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
            return {
                found: true,
                source: 'redis',
                tab,
                timeframe,
                generatedAt: generatedAt.toISOString(),
                stale: stale(tab, generatedAt),
                personalized: positionBucket !== undefined,
                analysis: {
                    summary: a.summary,
                    trend: a.trend,
                    riskLevel: a.riskLevel,
                    keyLevels: a.keyLevels,
                    priceTargets: a.priceTargets,
                    actionRecommendation: a.actionRecommendation ?? null,
                },
            };
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
            return {
                found: true,
                source: 'redis',
                tab,
                timeframe,
                // `OverallAnalysisResponse` carries no generation timestamp,
                // so we cannot know the real age of this cache hit — do not
                // invent one. `null` = "freshness unknown", not "just generated".
                generatedAt: null,
                stale: null,
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
        // en/ja/zh questions), so a Japanese-only row still beats a fresh run.
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
            stale: stale(tab, snapshot.generatedAt),
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
                stale: stale(tab, latest.generatedAt),
                digest: latest,
            };
    }
    return { found: false, tab, symbol, hint: 'call run_fresh_analysis' };
};
