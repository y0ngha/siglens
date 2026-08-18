'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { revalidateTag } from 'next/cache';
import { isE2E } from '@/shared/api/e2eEnv';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import { runNewsCardAnalysis, type NewsItem } from '@y0ngha/siglens-core';
import {
    DrizzleMarketNewsRepository,
    isRecentlyFetched,
    markFetched,
} from '../api';
import { getMarketNewsClient } from '../lib/getMarketNewsClient';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import {
    MARKET_NEWS_LOOKBACK_MS,
    MARKET_NEWS_CACHE_TAG_PREFIX,
    LLM_PARALLEL_LIMIT,
} from '../lib/marketNewsConstants';
/** Divisor for the upsert-majority-failure threshold: if more than half of fetched items fail to upsert, abort. */
const MAJORITY_DIVISOR = 2;

/**
 * Run per-card AI analysis for a single item and persist the result to DB.
 *
 * Caller guarantees that `item` has not been analyzed yet (analyzedAt === null).
 * `runNewsCardAnalysis` returns `{ status: 'done', result }` directly — no polling.
 *
 * 추론 on/off는 여기서 정하지 않는다 — `runNewsCardAnalysis`가 use-case 정책으로
 * `reasoning: false`를 고정한다. 구 `thinkingBudget: 0`은 Gemini 전용 인자였고
 * DeepSeek 분기에서는 무시되므로 제거했다.
 */
async function analyzeAndPersist(
    item: NewsItem,
    repo: DrizzleMarketNewsRepository
): Promise<void> {
    const analyzed = await runNewsCardAnalysis({ item });

    // titleKo·summaryKo가 둘 다 비면 core normalizer의 crash-safe fallback이다.
    // 저장하면 `analyzedAt`이 세팅되어 재분석 대상에서 영구히 빠지고
    // sentiment/category가 기본값으로 고착한다 — 심볼 뉴스 경로
    // (`ensureNewsCardsAnalyzedAction`) 및 경제 이벤트 경로와 동일한 skip 정책.
    // 조건을 좁힌 이유(재시도 비용) 포함 자세한 근거는 그쪽 주석 참고.
    //
    // 이 경로는 심볼 뉴스와 달리 `isRecentlyFetched(sentinel)`가 봇·사람 구분 없이
    // 걸려 있어(아래 참조) 재시도가 refresh TTL 주기로 자연히 제한된다.
    const { titleKo, summaryKo } = analyzed.result;
    if (titleKo.trim() === '' && summaryKo.trim() === '') {
        console.warn(
            `[ensureMarketNewsCardsAnalyzedAction] empty card analysis — skipping persist for ${item.id}`
        );
        return;
    }

    await repo.attachAnalysis(item.id, analyzed.result, new Date());
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
    category: NewsFeedCategoryId
): Promise<void> {
    try {
        const { sentinel } = CATEGORY_CONFIG[category];

        if (await isRecentlyFetched(sentinel)) {
            return;
        }

        // Mark before the async fetch so that a second concurrent caller that
        // reads the flag after this point will skip the upstream round-trip.
        await markFetched(sentinel);

        // 소스(FMP / 네이버)는 카테고리가 결정한다 — `CATEGORY_CONFIG[category].source`.
        const newsClient = getMarketNewsClient(category);
        const { db } = getDatabaseClient();
        const repo = new DrizzleMarketNewsRepository(db);

        const fresh = await newsClient
            .fetchCategoryNews(category, MARKET_NEWS_LOOKBACK_MS)
            .catch((err: unknown) => {
                console.error(
                    '[ensureMarketNewsCardsAnalyzedAction] feed fetch failed:',
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

        // `fresh` comes from the upstream feed and has no `analyzedAt`; re-read DB to skip items
        // that a previous run already analyzed — avoids duplicate LLM submissions.
        // 필요한 건 "이미 분석됨" 집합뿐이라 id만 읽는다 — 전 컬럼을 읽으면 본문까지
        // 받아서 그대로 버린다(감사: 비용 라운드 15).
        const analyzedIds = await repo.listAnalyzedIds(
            sentinel,
            MARKET_NEWS_LOOKBACK_MS
        );
        // Only send items whose DB row was successfully upserted to LLM —
        // if upsert failed, `attachAnalysis` would error with "row not found",
        // wasting LLM credits. The majority-failure guard above already handles
        // bulk failures; this filters the surviving minority rejects.
        const upsertedIds = new Set(
            upsertSettled.flatMap((r, i) =>
                r.status === 'fulfilled' ? [fresh[i].id] : []
            )
        );
        const unanalyzed = fresh.filter(
            item => upsertedIds.has(item.id) && !analyzedIds.has(item.id)
        );

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
