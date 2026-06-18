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
} from '../lib/marketNewsConstants';
import {
    DISABLED_THINKING_BUDGET,
    NEWS_CARD_ANALYSIS_POLL_INTERVAL_MS as POLL_INTERVAL_MS,
    POLL_MAX_ATTEMPTS,
} from '@/entities/news-article';

/** Divisor for the upsert-majority-failure threshold: if more than half of fetched items fail to upsert, abort. */
const MAJORITY_DIVISOR = 2;

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
 *
 * @param options.skipAnalysis When true (bot traffic), FMP fetch + DB upsert
 *   still run but LLM card analysis is skipped to avoid unnecessary worker cost.
 */
export async function ensureMarketNewsCardsAnalyzedAction(
    category: NewsFeedCategory,
    options?: { skipAnalysis?: boolean }
): Promise<void> {
    try {
        const { sentinel } = CATEGORY_CONFIG[category];

        // SEO-safe: bots get existing DB rows, so skipping FMP fetch doesn't cause stale content.
        if (options?.skipAnalysis && (await isRecentlyFetched(sentinel))) {
            return;
        }

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
        await markFetched(sentinel);

        if (fresh.length === 0) return;

        // Only revalidate when at least one row was actually inserted or changed.
        // `upsertMarketNewsItem` returns true only on genuine content change (setWhere).
        const changedCount = upsertSettled.filter(
            r => r.status === 'fulfilled' && r.value === true
        ).length;
        if (changedCount > 0) {
            // Use 'market-news:<sentinel>' tag so only the category's ISR cache is
            // busted — bars/profile/analysis caches for per-symbol pages are untouched.
            // Next.js 16.2.0 revalidateTag signature: (tag: string, profile: string | CacheLifeConfig).
            // 'max' uses the maximum stale-while-revalidate profile so this tag busts immediately.
            // See: node_modules/next/dist/server/web/spec-extension/revalidate.d.ts
            revalidateTag(`${MARKET_NEWS_CACHE_TAG_PREFIX}:${sentinel}`, 'max');
        }

        if (isE2E()) return;

        if (options?.skipAnalysis) return;

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

        let analyzeFailures = 0;
        // Sequential: avoid overwhelming the LLM worker with concurrent per-item submissions.
        for (const item of unanalyzed) {
            try {
                await analyzeAndPersist(item, repo);
            } catch (err) {
                analyzeFailures += 1;
                console.error(
                    '[ensureMarketNewsCardsAnalyzedAction] analyzeAndPersist failed for',
                    item.id,
                    err
                );
            }
        }
        if (analyzeFailures > 0) {
            console.error(
                `[ensureMarketNewsCardsAnalyzedAction] ${analyzeFailures}/${unanalyzed.length} analyzeAndPersist failed`
            );
        }
    } catch (error) {
        console.error('[ensureMarketNewsCardsAnalyzedAction]', error);
    }
}
