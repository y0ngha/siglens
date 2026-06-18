'use client';

import {
    useState,
    startTransition,
    useEffect,
    useRef,
    useCallback,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
    NewsAnalysisResponse,
    NewsFeedCategory,
} from '@y0ngha/siglens-core';
import {
    cancelMarketNewsDigestAction,
    ensureMarketNewsCardsAnalyzedAction,
} from '@/entities/market-news/actions';
import { fetchMarketNewsDigest } from '../utils/fetchMarketNewsDigest';
import { useWaitForMarketNewsCards } from './useWaitForMarketNewsCards';

export type MarketNewsDigestState =
    | { status: 'loading' }
    | { status: 'done'; result: NewsAnalysisResponse }
    | { status: 'error'; error: Error; retry: () => void };

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

/**
 * Orchestrates the full market-news category digest lifecycle:
 *
 * 1. Fires `ensureMarketNewsCardsAnalyzedAction(category)` once on mount
 *    (fire-and-forget) to ingest and enrich cards.
 * 2. Waits for ≥1 enriched card (polls `getMarketNewsCardsAction` at 3s interval)
 *    unless `hasEnrichedNews` is already true from SSR.
 * 3. When ready, calls `submitMarketNewsDigestAction(category)` and polls via
 *    `pollMarketNewsDigestAction` until done or error.
 * 4. On unmount (or category change) cancels any in-flight job via `cancelMarketNewsDigestAction`.
 *
 * Output: discriminated union `loading | done | error`.
 * No `usePublishSymbolChat` — this is a category page, not a per-symbol page.
 */
export function useMarketNewsDigest(
    category: NewsFeedCategory,
    hasEnrichedNews: boolean
): MarketNewsDigestState {
    const [isHydrated, setIsHydrated] = useState(false);
    const currentJobIdRef = useRef<string | null>(null);

    // Single custom hook that drives the `enabled` flag (input-provider pattern).
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

    useMarketNewsAnalysisTrigger(category);

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

    // Hydration gate — set after first client render so SSR and client
    // render match (avoids useQuery firing during hydration).
    useEffect(() => {
        startTransition(() => setIsHydrated(true));
    }, []);

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
