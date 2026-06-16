'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
    NewsAnalysisResponse,
    NewsFeedCategory,
} from '@y0ngha/siglens-core';
import {
    ensureMarketNewsCardsAnalyzedAction,
    getMarketNewsCardsAction,
    submitMarketNewsDigestAction,
    pollMarketNewsDigestAction,
    cancelMarketNewsDigestAction,
} from '@/entities/market-news/actions';
import { sleep } from '@/shared/lib/sleep';
import { ANALYSIS_POLL_INTERVAL_MS } from '@/shared/config/pollingConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { POLL_INTERVAL_MS, MAX_CONSECUTIVE_FAILURES } from '../constants';

export type MarketNewsDigestState =
    | { status: 'loading' }
    | { status: 'done'; result: NewsAnalysisResponse }
    | { status: 'error'; error: Error; retry: () => void };

interface WaitForMarketNewsCardsResult {
    isReady: boolean;
    waitError: Error | null;
}

/**
 * Poll `getMarketNewsCardsAction` until at least one enriched card (sentiment
 * !== null) is available, then resolve. Returns `isReady = true` immediately
 * if `initiallyReady` is true.
 *
 * Inline mirror of useWaitForNewsCards adapted for market-news categories.
 */
function useWaitForMarketNewsCards(
    category: NewsFeedCategory,
    initiallyReady: boolean
): WaitForMarketNewsCardsResult {
    const [isReady, setIsReady] = useState(initiallyReady);
    const [waitError, setWaitError] = useState<Error | null>(null);
    const [prevCategory, setPrevCategory] = useState(category);

    if (prevCategory !== category) {
        setPrevCategory(category);
        setIsReady(initiallyReady);
        setWaitError(null);
    }

    useEffect(() => {
        if (initiallyReady) return;

        let consecutiveFailures = 0;

        const intervalId = setInterval(async () => {
            try {
                const fresh = await getMarketNewsCardsAction(category);
                consecutiveFailures = 0;
                if (fresh.some(item => item.sentiment !== null)) {
                    setIsReady(true);
                    clearInterval(intervalId);
                }
            } catch (err) {
                consecutiveFailures += 1;
                console.error('[useWaitForMarketNewsCards] poll failed:', err);
                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    setWaitError(
                        err instanceof Error ? err : new Error(String(err))
                    );
                    clearInterval(intervalId);
                }
            }
        }, POLL_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [category, initiallyReady]);

    return { isReady, waitError };
}

/**
 * Fire-and-forget: triggers `ensureMarketNewsCardsAnalyzedAction(category)`
 * once on mount (and once per category change). Silently logs errors — the
 * consumer does not need to react; if the ingestion fails, polling will simply
 * stay empty until the next FMP refresh cycle.
 */
function useMarketNewsAnalysisTrigger(category: NewsFeedCategory): void {
    const triggeredCategoryRef = useRef<string | null>(null);

    useEffect(() => {
        if (triggeredCategoryRef.current === category) return;
        triggeredCategoryRef.current = category;
        void ensureMarketNewsCardsAnalyzedAction(category).catch(
            (e: unknown) => {
                console.error(
                    '[useMarketNewsAnalysisTrigger] ensureMarketNewsCardsAnalyzedAction failed:',
                    e
                );
            }
        );
    }, [category]);
}

async function fetchMarketNewsDigest(
    category: NewsFeedCategory,
    signal: AbortSignal,
    onJobId: (jobId: string | null, expectedCurrent?: string | null) => void
): Promise<NewsAnalysisResponse> {
    if (signal.aborted) throw new Error('aborted');

    const submitted = await submitMarketNewsDigestAction(category);

    if (submitted.status === 'cached') return submitted.result;
    if (submitted.status === 'miss_no_trigger') {
        throw new Error(
            '다이제스트를 생성할 수 없어요. 잠시 후 다시 시도해 주세요.'
        );
    }
    if (submitted.status === 'no_news') {
        throw new Error('분석할 뉴스가 없어요. 잠시 후 다시 시도해 주세요.');
    }

    // submitted.status === 'submitted'
    onJobId(submitted.jobId);
    try {
        const { jobId } = submitted;
        while (!signal.aborted) {
            await sleep(ANALYSIS_POLL_INTERVAL_MS);
            if (signal.aborted) break;
            const polled = await pollMarketNewsDigestAction(jobId);
            if (polled.status === 'done') return polled.result;
            if (polled.status === 'error') {
                throw new Error(
                    polled.error ?? 'AI 다이제스트 생성 중 오류가 발생했어요.'
                );
            }
        }
    } finally {
        // Only clear the ref if this execution's jobId is still the current one.
        onJobId(null, submitted.jobId);
    }
    throw new Error('aborted');
}

/**
 * Orchestrates the full market-news category digest lifecycle:
 *
 * 1. Fires `ensureMarketNewsCardsAnalyzedAction(category)` once on mount
 *    (fire-and-forget) to ingest and enrich cards.
 * 2. Waits for ≥1 enriched card (polls `getMarketNewsCardsAction` at 3s interval)
 *    unless `hasEnrichedNews` is already true from SSR.
 * 3. When ready, calls `submitMarketNewsDigestAction(category)` and polls via
 *    `pollMarketNewsDigestAction` until done or error.
 * 4. On unmount cancels any in-flight job via `cancelMarketNewsDigestAction`.
 *
 * Output: discriminated union `loading | done | error`.
 * No `usePublishSymbolChat` — this is a category page, not a per-symbol page.
 */
export function useMarketNewsDigest(
    category: NewsFeedCategory,
    hasEnrichedNews: boolean
): MarketNewsDigestState {
    const currentJobIdRef = useRef<string | null>(null);
    const isHydrated = useHydrated();

    useMarketNewsAnalysisTrigger(category);

    const { isReady: isCardsReady, waitError } = useWaitForMarketNewsCards(
        category,
        hasEnrichedNews
    );

    const query = useQuery({
        queryKey: ['market-news-digest', category] as const,
        queryFn: ({ signal }) =>
            fetchMarketNewsDigest(
                category,
                signal,
                (jobId, expectedCurrent) => {
                    if (
                        expectedCurrent !== undefined &&
                        currentJobIdRef.current !== expectedCurrent
                    ) {
                        return;
                    }
                    currentJobIdRef.current = jobId;
                }
            ),
        // Wait for hydration + enriched cards before firing.
        // Firing on empty DB would give no_news immediately and staleTime: Infinity
        // would lock the error state until a hard refresh.
        enabled: isHydrated && isCardsReady,
        retry: false,
        staleTime: Infinity,
    });

    const retry = useCallback(() => {
        void query.refetch();
    }, [query]);

    // Cancel in-flight digest job on unmount or category change.
    useEffect(() => {
        return () => {
            const jobId = currentJobIdRef.current;
            if (jobId !== null) {
                currentJobIdRef.current = null;
                void cancelMarketNewsDigestAction(jobId).catch(error => {
                    console.warn('[useMarketNewsDigest] cancel failed', error);
                });
            }
        };
    }, [category]);

    // Surface wait errors (cards enrichment polling failure) as a digest error.
    if (waitError !== null) {
        return { status: 'error', error: waitError, retry };
    }

    if (query.isError) {
        return {
            status: 'error',
            error:
                query.error instanceof Error
                    ? query.error
                    : new Error('AI 다이제스트 생성 중 오류가 발생했어요.'),
            retry,
        };
    }

    if (query.isFetching) {
        return { status: 'loading' };
    }

    if (query.data !== undefined) {
        return { status: 'done', result: query.data };
    }

    return { status: 'loading' };
}
