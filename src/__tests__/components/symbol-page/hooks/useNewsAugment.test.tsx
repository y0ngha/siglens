/**
 * @jest-environment jsdom
 *
 * Documents the cache-only contract of `useNewsAugment` so that future
 * changes to QUERY_KEYS.newsAnalysis or the `queryFn: skipToken` policy
 * surface as test failures instead of silent regressions.
 */

import { useNewsAugment } from '@/components/symbol-page/hooks/useNewsAugment';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { renderHook } from '@testing-library/react';
import type { ModelId, NewsAnalysisResponse } from '@y0ngha/siglens-core';
import React from 'react';

const SYMBOL = 'AAPL';
const MODEL_ID = 'gemini-2.5-flash' as ModelId;

const SAMPLE_RESULT = {
    headlineKo: '단기 모멘텀',
    currentDriverKo: '실적 호조 기반 상승.',
    keyEventsKo: [],
    upcomingEventsKo: [],
} as unknown as NewsAnalysisResponse;

function makeWrapper(client: QueryClient) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

describe('useNewsAugment (cache-only contract)', () => {
    it('returns null when QUERY_KEYS.newsAnalysis is empty', () => {
        const client = new QueryClient();
        const { result } = renderHook(() => useNewsAugment(SYMBOL, MODEL_ID), {
            wrapper: makeWrapper(client),
        });
        expect(result.current).toBeNull();
    });

    it('returns the cached entry seeded under QUERY_KEYS.newsAnalysis', () => {
        const client = new QueryClient();
        client.setQueryData(
            QUERY_KEYS.newsAnalysis(SYMBOL, MODEL_ID),
            SAMPLE_RESULT
        );
        const { result } = renderHook(() => useNewsAugment(SYMBOL, MODEL_ID), {
            wrapper: makeWrapper(client),
        });
        expect(result.current).toBe(SAMPLE_RESULT);
    });

    it('does not start a fetch — query stays in idle/pending under skipToken', async () => {
        const client = new QueryClient();
        renderHook(() => useNewsAugment(SYMBOL, MODEL_ID), {
            wrapper: makeWrapper(client),
        });
        // skipToken contract: query is registered (state defined) and the fetch is never
        // initiated — fetchStatus stays 'idle', status stays 'pending' until cache seed.
        const state = client.getQueryState(
            QUERY_KEYS.newsAnalysis(SYMBOL, MODEL_ID)
        );
        expect(state).toBeDefined();
        expect(state?.fetchStatus).toBe('idle');
        expect(state?.status).toBe('pending');
    });

    it('does not cross-populate when modelId differs', () => {
        const client = new QueryClient();
        client.setQueryData(
            QUERY_KEYS.newsAnalysis(SYMBOL, MODEL_ID),
            SAMPLE_RESULT
        );
        const { result } = renderHook(
            () => useNewsAugment(SYMBOL, 'claude-haiku-4-5' as ModelId),
            { wrapper: makeWrapper(client) }
        );
        expect(result.current).toBeNull();
    });
});
