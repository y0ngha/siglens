'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleNewsRepository } from '@/entities/news-article';
import { getNewsClient } from '../lib/getNewsClient';
import {
    getFmpUserFacingMessage,
    isFmpPaymentRequiredError,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';
import {
    DISABLED_THINKING_BUDGET,
    POLL_INTERVAL_MS,
    POLL_MAX_ATTEMPTS,
} from '../lib/newsAnalysisConstants';
import { NEWS_LOOKBACK_MS } from '../lib/newsLookback';
import { isRecentlyFetched, markFetched } from '../lib/newsRefreshFlag';
import { revalidateTag } from 'next/cache';
import { sleep } from '@/shared/lib/sleep';
import { isE2E } from '@/shared/api/e2eEnv';
import {
    pollNewsCardAnalysis,
    submitNewsCardAnalysis,
    type NewsItem,
} from '@y0ngha/siglens-core';

/**
 * Submit card analysis for a single item and wait for the worker to finish,
 * then persist the result to DB via `attachAnalysis`.
 *
 * Caller guarantees that `item` has not been analyzed yet (analyzedAt === null).
 */
async function analyzeAndPersist(
    item: NewsItem,
    repo: DrizzleNewsRepository
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
                `[ensureNewsCardsAnalyzedAction] poll error ${item.id}: ${polled.error}`
            );
            return;
        }
    }
    console.warn(
        `[ensureNewsCardsAnalyzedAction] poll timeout after ${(POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s — ${item.id}`
    );
}

/**
 * Server Action: fetch fresh FMP news for `symbol`, upsert to DB, and
 * trigger per-card AI analysis for each item — polling until each worker
 * finishes so the result is persisted to DB in the same pass.
 *
 * DB-first: items that already have `analyzedAt` set are skipped — the DB
 * is the primary store for news-card analysis results.
 *
 * Designed to run inside `waitUntil` so it doesn't block the response stream.
 * Per-item errors are logged and never thrown; other items continue normally.
 *
 * @param options.skipAnalysis When true (bot traffic), FMP fetch + DB upsert
 *   still run but LLM card analysis is skipped to avoid unnecessary worker cost.
 */
export async function ensureNewsCardsAnalyzedAction(
    symbol: string,
    options?: { skipAnalysis?: boolean }
): Promise<void> {
    // 봇 경로만 가드: 최근 TTL 내 fetch했으면 FMP fetch + N건 DB upsert를 스킵한다.
    // 봇은 DB의 기존 뉴스를 그대로 읽으므로 SEO 무해. 사람 경로는 항상 fresh.
    if (options?.skipAnalysis && (await isRecentlyFetched(symbol))) {
        return;
    }

    const newsClient = getNewsClient();
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);

    const fresh = await newsClient
        .fetchNewsForPeriod(symbol, NEWS_LOOKBACK_MS)
        .catch((err: unknown) => {
            logFmpPaymentRequiredError(err);
            if (
                getFmpUserFacingMessage(err) === null &&
                !isFmpPaymentRequiredError(err)
            ) {
                console.error(
                    '[ensureNewsCardsAnalyzedAction] FMP fetch failed:',
                    err
                );
            }
            return null;
        });
    if (fresh === null) return;

    // Upsert all items first so the DB row exists before attachAnalysis runs.
    //
    // We deliberately do NOT wrap upsert + analyze in a drizzle transaction:
    // the analyze step calls an external LLM worker (`submitNewsCardAnalysis`)
    // which can take seconds to minutes, and a long-lived DB transaction would
    // hold connection-pool slots and risk pool exhaustion. Instead we use
    // Promise.allSettled and aggregate failure stats — and abort early if a
    // majority of upserts fail (likely a DB-wide outage, not transient).
    const upsertSettled = await Promise.allSettled(
        fresh.map(item => repo.upsertNewsItem(item))
    );
    const upsertFailures = upsertSettled.filter(r => r.status === 'rejected');
    if (upsertFailures.length > 0) {
        console.error(
            `[ensureNewsCardsAnalyzedAction] ${upsertFailures.length}/${fresh.length} upserts failed`,
            upsertFailures.map(f => (f.status === 'rejected' ? f.reason : null))
        );
    }
    if (upsertFailures.length > fresh.length / 2) {
        // Majority of upserts failed — almost certainly a DB-wide outage.
        // Throw so the caller (Server Action / waitUntil) knows to retry
        // rather than silently proceeding to analyze partial data.
        throw new Error(
            `[ensureNewsCardsAnalyzedAction] majority upsert failure (${upsertFailures.length}/${fresh.length})`
        );
    }
    await markFetched(symbol);

    if (fresh.length === 0) return;

    // fresh 기사가 있어 DB가 갱신됐으니 news ISR 캐시(news:${symbol} 그룹)를 무효화한다.
    // → 다음 요청부터 news 리스트/JSON-LD가 fresh. bars/peek/profile 캐시는 보존.
    // "max" profile: 캐시 항목을 즉시 만료시켜 다음 요청에서 재생성하게 한다.
    // (fresh.length === 0이면 DB 변경이 없어 위 guard에서 먼저 리턴 — 불필요한 무효화 스킵.)
    revalidateTag(`news:${symbol.toUpperCase()}`, 'max');

    if (isE2E()) return;

    if (options?.skipAnalysis) return;

    // Read the current DB state after upsert so newly inserted rows are included.
    const rows = await repo.listBySymbol(symbol, NEWS_LOOKBACK_MS);
    const analyzedIds = new Set(
        rows.filter(r => r.analyzedAt !== null).map(r => r.id)
    );
    const unanalyzed = fresh.filter(item => !analyzedIds.has(item.id));

    if (unanalyzed.length === 0) return;

    // Each item polls its own background worker independently.
    const analyzeSettled = await Promise.allSettled(
        unanalyzed.map(item => analyzeAndPersist(item, repo))
    );
    const analyzeFailures = analyzeSettled.filter(r => r.status === 'rejected');
    if (analyzeFailures.length > 0) {
        console.error(
            `[ensureNewsCardsAnalyzedAction] ${analyzeFailures.length}/${unanalyzed.length} analyzeAndPersist failed`,
            analyzeFailures.map(f =>
                f.status === 'rejected' ? f.reason : null
            )
        );
    }
}
