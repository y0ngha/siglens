/**
 * Branch/state coverage tests for useMarketNewsDigest.
 *
 * Mocks:
 * - @/entities/market-news/actions — all five server actions
 * - @/widgets/market-news/hooks/utils/fetchMarketNewsDigest — the inner async
 *   fetcher so we can control queryFn outcomes without running the full submit/
 *   poll loop
 * - @/shared/hooks/useHydrated — to toggle the hydration gate
 * - @/shared/lib/sleep — keep tests synchronous where possible
 */

import type { MockedFunction } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';
import { useHydrated } from '@/shared/hooks/useHydrated';
import {
    getMarketNewsCardsAction,
    ensureMarketNewsCardsAnalyzedAction,
} from '@/entities/market-news/actions';
import {
    fetchMarketNewsDigest,
    cancelMarketNewsDigestAction as cancelFromFetchModule,
} from '@/widgets/market-news/hooks/utils/fetchMarketNewsDigest';
import { useMarketNewsDigest } from '@/widgets/market-news/hooks/useMarketNewsDigest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/entities/market-news/actions', () => ({
    ensureMarketNewsCardsAnalyzedAction: vi.fn().mockResolvedValue(undefined),
    getMarketNewsCardsAction: vi.fn(),
    submitMarketNewsDigestAction: vi.fn(),
    pollMarketNewsDigestAction: vi.fn(),
    cancelMarketNewsDigestAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/widgets/market-news/hooks/utils/fetchMarketNewsDigest', () => ({
    fetchMarketNewsDigest: vi.fn(),
    // The hook imports cancelMarketNewsDigestAction from this module path
    // (fetchMarketNewsDigest.ts re-exports it from @/entities/market-news/actions).
    // We must mock it here so the hook's cleanup effect hits our spy.
    cancelMarketNewsDigestAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: vi.fn(() => true),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

// ─── Typed mocks ──────────────────────────────────────────────────────────────

const mockFetchMarketNewsDigest = fetchMarketNewsDigest as MockedFunction<
    typeof fetchMarketNewsDigest
>;
const mockUseHydrated = vi.mocked(useHydrated);
// The hook imports cancelMarketNewsDigestAction from the fetchMarketNewsDigest
// module path — that is the mock we must assert against.
const mockCancelFromFetchModule = cancelFromFetchModule as MockedFunction<
    typeof cancelFromFetchModule
>;
const mockGetMarketNewsCardsAction = getMarketNewsCardsAction as MockedFunction<
    typeof getMarketNewsCardsAction
>;
const mockEnsureMarketNewsCardsAnalyzedAction =
    ensureMarketNewsCardsAnalyzedAction as MockedFunction<
        typeof ensureMarketNewsCardsAnalyzedAction
    >;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DIGEST_RESULT: NewsAnalysisResponse = {
    overallSentiment: 'bullish',
    currentDriverKo: '연준의 금리 동결 결정이 시장 심리를 지지하고 있습니다.',
    keyEventsKo: ['FOMC 회의 금리 동결 결정'],
    upcomingEventsKo: ['4분기 실적 시즌 본격 개막'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    queryClients.push(client);
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useMarketNewsDigest', () => {
    beforeEach(() => {
        mockFetchMarketNewsDigest.mockReset();
        mockCancelFromFetchModule.mockReset();
        mockCancelFromFetchModule.mockResolvedValue(undefined);
        mockGetMarketNewsCardsAction.mockReset();
        mockEnsureMarketNewsCardsAnalyzedAction.mockReset();
        mockEnsureMarketNewsCardsAnalyzedAction.mockResolvedValue(undefined);
        mockUseHydrated.mockReturnValue(true);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    it('isHydrated=false → enabled=false, queryFn is NOT called', async () => {
        mockUseHydrated.mockReturnValue(false);

        const { result } = renderHook(
            () => useMarketNewsDigest('general', true),
            { wrapper: makeWrapper() }
        );

        // Small tick to let effects flush without calling queryFn.
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(mockFetchMarketNewsDigest).not.toHaveBeenCalled();
        expect(result.current.status).toBe('loading');
    });

    it('waitError from cards waiter surfaces as status: error', async () => {
        // cards waiter polls getMarketNewsCardsAction on a 3s interval; make it
        // fail MAX_CONSECUTIVE_FAILURES (3) times so waitError gets set.
        const cardError = new Error('DB unavailable');
        mockGetMarketNewsCardsAction.mockRejectedValue(cardError);
        // Pass hasEnrichedNews=false so the waiter actually starts polling.
        vi.useFakeTimers();

        const { result } = renderHook(
            () => useMarketNewsDigest('general', false),
            { wrapper: makeWrapper() }
        );

        // Advance 3 poll intervals (POLL_INTERVAL_MS = 3000ms from constants).
        for (let i = 0; i < 3; i++) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(3000);
            });
        }

        expect(result.current.status).toBe('error');

        vi.useRealTimers();
    });

    it('React Query isError (fetchMarketNewsDigest throws) → status: error', async () => {
        const fetchError = new Error('network failure');
        mockFetchMarketNewsDigest.mockRejectedValue(fetchError);

        const { result } = renderHook(
            () => useMarketNewsDigest('stock', true),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error).toBeInstanceOf(Error);
    });

    it('React Query data resolves → status: done with digest body', async () => {
        mockFetchMarketNewsDigest.mockResolvedValue(DIGEST_RESULT);

        const { result } = renderHook(
            () => useMarketNewsDigest('crypto', true),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });

        if (result.current.status !== 'done') throw new Error('expected done');
        expect(result.current.result).toEqual(DIGEST_RESULT);
    });

    it('loading state (no data, no error, hydrated) → status: loading', async () => {
        // queryFn never resolves → stays in loading state.
        mockFetchMarketNewsDigest.mockImplementation(
            () => new Promise(() => {})
        );

        const { result, unmount } = renderHook(
            () => useMarketNewsDigest('articles', true),
            { wrapper: makeWrapper() }
        );

        // At least one tick so isFetching becomes true.
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(result.current.status).toBe('loading');

        unmount();
    });

    it('unmount with jobId present → cancelMarketNewsDigestAction called', async () => {
        // fetchMarketNewsDigest is a thin wrapper; we simulate a job being in
        // flight by making the queryFn set the jobId ref via onJobId and then
        // hang. The actual cancellation path in the hook uses the
        // cancelMarketNewsDigestAction imported from the same utils module.
        //
        // Instead, we test the effect cleanup path: the hook calls
        // cancelMarketNewsDigestAction(jobId) on unmount. We mock the module so
        // that fetchMarketNewsDigest internally calls the onJobId callback and
        // then hangs, simulating a submitted-but-not-yet-done job.
        mockFetchMarketNewsDigest.mockImplementation(
            async (_cat, _signal, onJobId) => {
                onJobId('job-market-456');
                return new Promise<NewsAnalysisResponse>(() => {});
            }
        );

        const { unmount } = renderHook(
            () => useMarketNewsDigest('forex', true),
            { wrapper: makeWrapper() }
        );

        // Wait for queryFn to be called and onJobId to set the ref.
        await waitFor(() => {
            expect(mockFetchMarketNewsDigest).toHaveBeenCalled();
        });

        unmount();

        // The hook's cleanup effect calls cancelMarketNewsDigestAction with the
        // stored jobId. Give microtasks a chance to flush.
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(mockCancelFromFetchModule).toHaveBeenCalledWith(
            'job-market-456'
        );
    });

    it('retry() calls query.refetch() (triggers a second queryFn call)', async () => {
        mockFetchMarketNewsDigest
            .mockRejectedValueOnce(new Error('first attempt failed'))
            .mockResolvedValueOnce(DIGEST_RESULT);

        const { result } = renderHook(
            () => useMarketNewsDigest('general', true),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        const errorState = result.current;
        if (errorState.status !== 'error') throw new Error('expected error');

        act(() => {
            errorState.retry();
        });

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });

        expect(mockFetchMarketNewsDigest).toHaveBeenCalledTimes(2);
    });
});
