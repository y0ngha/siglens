'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { revalidateTag } from 'next/cache';
import { isE2E } from '@/shared/api/e2eEnv';
import { sleep } from '@/shared/lib/sleep';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    pollNewsCardAnalysis,
    submitNewsCardAnalysis,
    type NewsItem,
    type NewsFeedCategory,
} from '@y0ngha/siglens-core';
import {
    DrizzleMarketNewsRepository,
    isRecentlyFetched,
    markFetched,
} from '../api';
import { getMarketNewsClient } from '../lib/getMarketNewsClient';
import { CATEGORY_CONFIG } from '../lib/categoryConfig';
import {
    MARKET_NEWS_LOOKBACK_MS,
    MARKET_NEWS_CACHE_TAG_PREFIX,
    LLM_PARALLEL_LIMIT,
} from '../lib/marketNewsConstants';
import {
    DISABLED_THINKING_BUDGET,
    NEWS_CARD_ANALYSIS_POLL_INTERVAL_MS as POLL_INTERVAL_MS,
    POLL_MAX_ATTEMPTS,
} from '@/entities/news-article';

/** Divisor for the upsert-majority-failure threshold: if more than half of fetched items fail to upsert, abort. */
const MAJORITY_DIVISOR = 2;

/**
 * Run `fn` over each item in `items`, at most `limit` items concurrently.
 * Returns settled results in input order, identical to `Promise.allSettled`.
 *
 * Avoids adding `p-limit` as a dependency; the loop-slice pattern is
 * sufficient for the O(50) item sizes seen here.
 */
async function withConcurrencyLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = [];
    for (let i = 0; i < items.length; i += limit) {
        const chunk = items.slice(i, i + limit);
        results.push(...(await Promise.allSettled(chunk.map(fn))));
    }
    return results;
}

/**
 * Submit per-card AI analysis for a single item and wait for the worker to
 * finish, then persist the result to DB via `attachAnalysis`.
 *
 * Caller guarantees that `item` has not been analyzed yet (analyzedAt === null).
 */
async function analyzeAndPersist(
    item: NewsItem,
    repo: DrizzleMarketNewsRepository
): Promise<void> {
    const { jobId } = await submitNewsCardAnalysis({
        item,
        thinkingBudget: DISABLED_THINKING_BUDGET,
    });

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        await sleep(POLL_INTERVAL_MS);
        const polled = await pollNewsCardAnalysis(jobId);
        if (polled.status === 'done') {
            await repo.attachAnalysis(item.id, polled.result, new Date());
            return;
        }
        if (polled.status === 'error') {
            console.error(
                `[ensureMarketNewsCardsAnalyzedAction] poll error ${item.id}: ${polled.error}`
            );
            return;
        }
    }
    console.warn(
        `[ensureMarketNewsCardsAnalyzedAction] poll timeout after ${(POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS) / MS_PER_SECOND}s — ${item.id}`
    );
}

/**
 * Server Action: fetch fresh FMP market-news for `category`, upsert to the
 * `market_news` table, and trigger per-card AI analysis for unenriched items.
 *
 * Unlike the per-symbol equivalent, there is NO tier/BYOK gate — category
 * digests are public. The sentinel (`CATEGORY_CONFIG[category].sentinel`)
 * is used as the DB bucket symbol and Redis refresh key.
 *
 * DB-first: items already with `analyzedAt` set are skipped. Per-item errors
 * are logged and never thrown; other items continue normally.
 *
 * Designed to run inside `waitUntil` so it does not block the response stream.
 */
export async function ensureMarketNewsCardsAnalyzedAction(
    category: NewsFeedCategory
): Promise<void> {
    try {
        const { sentinel } = CATEGORY_CONFIG[category];

        if (await isRecentlyFetched(sentinel)) {
            return;
        }

        // Mark before the async fetch so that a second concurrent caller that
        // reads the flag after this point will skip the FMP round-trip.
        await markFetched(sentinel);

        const newsClient = getMarketNewsClient();
        const { db } = getDatabaseClient();
        const repo = new DrizzleMarketNewsRepository(db);

        const fresh = await newsClient
            .fetchCategoryNews(category, MARKET_NEWS_LOOKBACK_MS)
            .catch((err: unknown) => {
                console.error(
                    '[ensureMarketNewsCardsAnalyzedAction] FMP fetch failed:',
                    err
                );
                return null;
            });
        if (fresh === null) return;

        // Upsert all items first so the DB row exists before attachAnalysis runs.
        // We do NOT wrap upsert + analyze in a transaction — LLM polling can take
        // seconds and would hold connection-pool slots (same rationale as per-symbol).
        const upsertSettled = await Promise.allSettled(
            fresh.map(item => repo.upsertMarketNewsItem(item))
        );
        const upsertFailures = upsertSettled.filter(
            r => r.status === 'rejected'
        );
        if (upsertFailures.length > 0) {
            console.error(
                `[ensureMarketNewsCardsAnalyzedAction] ${upsertFailures.length}/${fresh.length} upserts failed`,
                upsertFailures.map(f =>
                    f.status === 'rejected' ? f.reason : null
                )
            );
        }
        if (upsertFailures.length > fresh.length / MAJORITY_DIVISOR) {
            console.error(
                `[ensureMarketNewsCardsAnalyzedAction] majority upsert failure (${upsertFailures.length}/${fresh.length}) — aborting`
            );
            return;
        }

        if (fresh.length === 0) return;

        // Only revalidate when at least one row was actually inserted or changed.
        // `upsertMarketNewsItem` returns true only on genuine content change (setWhere).
        const changedCount = upsertSettled.filter(
            r => r.status === 'fulfilled' && r.value === true
        ).length;
        if (changedCount > 0) {
            // Use 'market-news:<sentinel>' tag so only the category's ISR cache is
            // busted — bars/profile/analysis caches for per-symbol pages are untouched.
            // See Next.js 16.2 revalidateTag(tag, profile?) signature — 'max' busts immediately.
            revalidateTag(`${MARKET_NEWS_CACHE_TAG_PREFIX}:${sentinel}`, 'max');
        }

        if (isE2E()) return;

        // `fresh` comes from FMP and has no `analyzedAt`; re-read DB to skip items
        // that a previous run already analyzed — avoids duplicate LLM submissions.
        const rows = await repo.listByCategory(
            sentinel,
            MARKET_NEWS_LOOKBACK_MS
        );
        const analyzedIds = new Set(
            rows.filter(r => r.analyzedAt !== null).map(r => r.id)
        );
        // Only send items whose DB row was successfully upserted to LLM —
        // if upsert failed, `attachAnalysis` would error with "row not found",
        // wasting LLM credits. The majority-failure guard above already handles
        // bulk failures; this filters the surviving minority rejects.
        const upsertedIds = new Set(
            upsertSettled
                .map((r, i) => (r.status === 'fulfilled' ? fresh[i].id : null))
                .filter((id): id is string => id !== null)
        );
        const unanalyzed = fresh
            .filter(item => upsertedIds.has(item.id))
            .filter(item => !analyzedIds.has(item.id));

        if (unanalyzed.length === 0) return;

        // Chunked-parallel: submit card analyses in batches of LLM_PARALLEL_LIMIT.
        // Unbounded Promise.allSettled(50 items) risks a worker-queue stampede.
        // Batching keeps concurrency bounded while still parallelising within each chunk.
        const analyzeSettled = await withConcurrencyLimit(
            unanalyzed,
            LLM_PARALLEL_LIMIT,
            item => analyzeAndPersist(item, repo)
        );
        const analyzeFailures = analyzeSettled.filter(
            r => r.status === 'rejected'
        );
        if (analyzeFailures.length > 0) {
            console.error(
                `[ensureMarketNewsCardsAnalyzedAction] ${analyzeFailures.length}/${unanalyzed.length} analyzeAndPersist failed`,
                analyzeFailures.map(f =>
                    f.status === 'rejected' ? f.reason : null
                )
            );
        }
        if (analyzeFailures.length > unanalyzed.length / MAJORITY_DIVISOR) {
            console.error(
                `[ensureMarketNewsCardsAnalyzedAction] majority analyzeAndPersist failure (${analyzeFailures.length}/${unanalyzed.length})`
            );
        }
    } catch (error) {
        console.error('[ensureMarketNewsCardsAnalyzedAction]', error);
    }
}
