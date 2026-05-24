'use server';

import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleNewsRepository } from '@/infrastructure/db/newsRepository';
import { FmpNewsClient } from '@/infrastructure/fmp/newsClient';
import { DISABLED_THINKING_BUDGET } from '@/infrastructure/market/newsAnalysisConstants';
import { NEWS_LOOKBACK_MS } from '@/infrastructure/market/newsLookback';
import { sleep } from '@/shared/lib/sleep';
import {
    pollNewsCardAnalysis,
    submitNewsCardAnalysis,
    type NewsItem,
} from '@y0ngha/siglens-core';

const POLL_INTERVAL_MS = 2_000;
/**
 * Flash-lite typical wall-clock: <10 s. 30 attempts × 2 s = 60 s ceiling,
 * well within waitUntil's serverless budget.
 */
const POLL_MAX_ATTEMPTS = 30;

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
 */
export async function ensureNewsCardsAnalyzedAction(
    symbol: string
): Promise<void> {
    const newsClient = new FmpNewsClient();
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);

    const fresh = await newsClient
        .fetchNewsForPeriod(symbol, NEWS_LOOKBACK_MS)
        .catch((err: unknown) => {
            console.error(
                '[ensureNewsCardsAnalyzedAction] FMP fetch failed:',
                err
            );
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

    if (fresh.length === 0) return;

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
