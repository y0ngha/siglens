'use client';

import { useTranslations } from 'next-intl';
import type { NewsFeedCategoryId } from '@/entities/market-news';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { useStreamErrorMessages } from '@/shared/hooks/useStreamErrorMessages';
import { useState, startTransition, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { ensureMarketNewsCardsAnalyzedAction } from '@/entities/market-news/actions';
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
function useMarketNewsAnalysisTrigger(category: NewsFeedCategoryId): void {
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
 * 3. When ready, calls `submitMarketNewsDigestAction(category)` and awaits
 *    result directly (run* is blocking — no poll loop needed).
 *
 * Output: discriminated union `loading | done | error`.
 */
export function useMarketNewsDigest(
    category: NewsFeedCategoryId,
    hasEnrichedNews: boolean,
    /**
     * SSR-peeked cached digest (`peekMarketNewsDigestStatic`), or `null`/`undefined`
     * on a miss. Mirrors `useMarketBriefing`'s `peekSeed` priority: seed wins over
     * every failure branch (wait error, query error, still-loading) so the SSR
     * HTML's digest text is never replaced by a skeleton or error card in the
     * rendered DOM — a fresh successful fetch still replaces it.
     */
    peekSeed?: NewsAnalysisResponse | null
): MarketNewsDigestState {
    const tError = useTranslations('shared.ui.analysisError');
    const locale = useCurrentLocale();
    const streamMessages = useStreamErrorMessages();
    const [isHydrated, setIsHydrated] = useState(false);

    // Single custom hook that drives the `enabled` flag (input-provider pattern).
    const { isReady: isCardsReady, waitError } = useWaitForMarketNewsCards(
        category,
        hasEnrichedNews
    );

    const query = useQuery({
        queryKey: QUERY_KEYS.marketNewsDigest(category, locale),
        queryFn: ({ signal }) =>
            fetchMarketNewsDigest(category, streamMessages, signal),
        // Wait for hydration + enriched cards before firing.
        // Firing on empty DB would give no_news immediately and staleTime: Infinity
        // would lock the error state until a hard refresh.
        enabled: isHydrated && isCardsReady,
        retry: false,
        staleTime: Infinity,
    });

    useMarketNewsAnalysisTrigger(category);

    // §17 exception: `refetch` is destructured immediately after useQuery
    // because it feeds the useCallback below. The `refetch` reference is
    // stable across renders (React Query guarantee), so this satisfies
    // exhaustive-deps without introducing unstable derived values.
    const { refetch } = query;

    const retry = () => {
        void refetch();
    };

    // Hydration gate — set after first client render so SSR and client
    // render match (avoids useQuery firing during hydration).
    useEffect(() => {
        startTransition(() => setIsHydrated(true));
    }, []);

    // seed 우선은 실패 분기 전부에 적용한다 — SSR HTML의 다이제스트 본문이
    // 렌더된 DOM에서 스켈레톤/에러 카드로 교체되지 않도록 (useMarketBriefing과
    // 동일한 이유). 신선한 fetch 성공(`query.data`)만 seed를 대체한다.
    const seedResult: NewsAnalysisResponse | undefined = peekSeed ?? undefined;

    // Surface wait errors (cards enrichment polling failure) as a digest error.
    if (waitError !== null) {
        if (seedResult) return { status: 'done', result: seedResult };
        return { status: 'error', error: waitError, retry };
    }

    if (query.isError) {
        if (seedResult) return { status: 'done', result: seedResult };
        return {
            status: 'error',
            error:
                query.error instanceof Error
                    ? query.error
                    : new Error(tError('digestFailed')),
            retry,
        };
    }

    if (query.data !== undefined) {
        return { status: 'done', result: query.data };
    }

    if (query.isFetching) {
        if (seedResult) return { status: 'done', result: seedResult };
        return { status: 'loading' };
    }

    if (seedResult) return { status: 'done', result: seedResult };

    return { status: 'loading' };
}
