'use client';

import { useQuery } from '@tanstack/react-query';
import type { NewsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';
import { QUERY_KEYS } from '@/lib/queryConfig';

/**
 * Chart-page news augment — strictly cache-only.
 *
 * Returns the existing News-analysis result from the React Query cache
 * (populated by `useNewsAnalysis` on `/AAPL/news`). On cache miss, returns
 * `null` instead of submitting a new LLM job — the spec is explicit that the
 * chart page must not spend money on news analysis.
 *
 * Background filling is handled by natural navigation: when the user visits
 * `/AAPL/news`, `ensureNewsCardsAnalyzedAction` (RSC waitUntil) plus
 * `useNewsAnalysis` together populate both the server-side Redis cache and
 * this React Query entry. Subsequent navigation back to `/AAPL` then sees a
 * cache hit and renders the augment.
 *
 * Both hooks share the same queryKey (`QUERY_KEYS.newsAnalysis`) so a single
 * RQ entry serves both pages within a session. `enabled: false` ensures this
 * hook never triggers a fetch — it just subscribes to whatever the news page
 * has already cached.
 */
export function useNewsAugment(
    symbol: string,
    modelId: ModelId
): NewsAnalysisResponse | null {
    const { data } = useQuery<NewsAnalysisResponse>({
        queryKey: QUERY_KEYS.newsAnalysis(symbol, modelId),
        enabled: false,
    });
    return data ?? null;
}
