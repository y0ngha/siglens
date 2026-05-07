'use server';

import {
    submitNewsCardAnalysis,
    pollNewsCardAnalysis,
    type NewsItem,
} from '@y0ngha/siglens-core';
import { FmpNewsClient } from '@/infrastructure/fmp/newsClient';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleNewsRepository } from '@/infrastructure/db/newsRepository';
import { sleep } from '@/lib/sleep';

const POLL_INTERVAL_MS = 2_000;
/** Explicitly disables extended thinking for per-card translation/classification tasks. */
const DISABLED_THINKING_BUDGET = 0;
/**
 * Flash-lite typical wall-clock: <10 s. 30 attempts × 2 s = 60 s ceiling,
 * well within waitUntil's serverless budget.
 */
const POLL_MAX_ATTEMPTS = 30;

/**
 * Submit card analysis for a single item and wait for the worker to finish,
 * then persist the result to DB via `attachAnalysis`.
 *
 * Design: submitNewsCardAnalysis fires a background worker on the first call
 * (`submitted`) and returns the cached result on subsequent calls (`cached`).
 * Previous code only called attachAnalysis on `cached`, so the DB was always
 * one page-load behind. This function polls until done on `submitted` so the
 * DB is populated in the same waitUntil pass.
 */
async function analyzeAndPersist(
    item: NewsItem,
    repo: DrizzleNewsRepository
): Promise<void> {
    const submitResult = await submitNewsCardAnalysis({
        item,
        thinkingBudget: DISABLED_THINKING_BUDGET,
    });

    if (submitResult.status === 'cached') {
        await repo.attachAnalysis(item.id, submitResult.result, new Date());
        return;
    }

    // status === 'submitted': poll until the background worker finishes
    const { jobId } = submitResult;
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
        .fetchNews(symbol, '7d')
        .catch((err: unknown) => {
            console.error(
                '[ensureNewsCardsAnalyzedAction] FMP fetch failed:',
                err
            );
            return null;
        });
    if (fresh === null) return;

    console.log(
        `[ensureNewsCardsAnalyzedAction] symbol=${symbol} fresh=${fresh.length}`
    );

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

    // Analyze and persist all items in parallel — each polls its own worker.
    const analyzeSettled = await Promise.allSettled(
        fresh.map(item => analyzeAndPersist(item, repo))
    );
    const analyzeFailures = analyzeSettled.filter(r => r.status === 'rejected');
    if (analyzeFailures.length > 0) {
        console.error(
            `[ensureNewsCardsAnalyzedAction] ${analyzeFailures.length}/${fresh.length} analyzeAndPersist failed`,
            analyzeFailures.map(f =>
                f.status === 'rejected' ? f.reason : null
            )
        );
    }
}
