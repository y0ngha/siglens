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
    const submitResult = await submitNewsCardAnalysis({ item });

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
    await Promise.allSettled(
        fresh.map(item =>
            repo.upsertNewsItem(item).catch((err: unknown) => {
                console.error(
                    `[ensureNewsCardsAnalyzedAction] upsert failed ${item.id}:`,
                    err
                );
            })
        )
    );

    // Analyze and persist all items in parallel — each polls its own worker.
    await Promise.allSettled(
        fresh.map(item =>
            analyzeAndPersist(item, repo).catch((err: unknown) => {
                console.error(
                    `[ensureNewsCardsAnalyzedAction] analyzeAndPersist failed ${item.id}:`,
                    err
                );
            })
        )
    );
}
