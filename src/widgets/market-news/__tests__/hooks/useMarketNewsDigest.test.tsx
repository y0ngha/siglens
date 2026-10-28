/**
 * Branch/state coverage tests for useMarketNewsDigest.
 *
 * Mocks:
 * - @/entities/market-news/actions — all five server actions
 * - @/widgets/market-news/utils/fetchMarketNewsDigest — the inner async
 *   fetcher so we can control queryFn outcomes without running the full submit/
 *   poll loop
 * - @/shared/lib/sleep — keep tests synchronous where possible
 *
 * Note: useHydrated is no longer used by this hook (inlined as useState+useEffect
 * in B1 fix). The hydration gate is tested via the cards-waiter `enabled` path.
 */

import type { MockedFunction } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';
import { getMarketNewsCardsAction } from '@/entities/market-news/actions/getMarketNewsCardsAction';
import { ensureMarketNewsCardsAnalyzedAction } from '@/entities/market-news/actions/ensureMarketNewsCardsAnalyzedAction';
import { fetchMarketNewsDigest } from '@/widgets/market-news/utils/fetchMarketNewsDigest';
import { useMarketNewsDigest } from '@/widgets/market-news/hooks/useMarketNewsDigest';

vi.mock(
    '@/entities/market-news/actions/ensureMarketNewsCardsAnalyzedAction',
    () => ({
        ensureMarketNewsCardsAnalyzedAction: vi
            .fn()
            .mockResolvedValue(undefined),
    })
);
vi.mock('@/entities/market-news/actions/getMarketNewsCardsAction', () => ({
    getMarketNewsCardsAction: vi.fn(),
}));
vi.mock('@/entities/market-news/actions/submitMarketNewsDigestAction', () => ({
    submitMarketNewsDigestAction: vi.fn(),
}));

vi.mock('@/widgets/market-news/utils/fetchMarketNewsDigest', () => ({
    fetchMarketNewsDigest: vi.fn(),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockFetchMarketNewsDigest = fetchMarketNewsDigest as MockedFunction<
    typeof fetchMarketNewsDigest
>;
const mockGetMarketNewsCardsAction = getMarketNewsCardsAction as MockedFunction<
    typeof getMarketNewsCardsAction
>;
const mockEnsureMarketNewsCardsAnalyzedAction =
    ensureMarketNewsCardsAnalyzedAction as MockedFunction<
        typeof ensureMarketNewsCardsAnalyzedAction
    >;

const ENRICHED_CARD: MarketNewsCardItem = {
    id: 'mn-1',
    publishedAt: '2026-06-15T10:00:00.000Z',
    titleEn: 'Fed holds',
    titleKo: '연준 동결',
    sentiment: 'bullish',
    category: 'macro',
    bodyKo: null,
    summaryKo: '요약',
    priceImpact: 'medium',
    url: 'https://example.com/fed',
    source: 'Reuters',
    tickers: [],
};

const DIGEST_RESULT: NewsAnalysisResponse = {
    overallSentiment: 'bullish',
    currentDriverKo: '연준의 금리 동결 결정이 시장 심리를 지지하고 있습니다.',
    keyEventsKo: ['FOMC 회의 금리 동결 결정'],
    upcomingEventsKo: ['4분기 실적 시즌 본격 개막'],
};

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

describe('useMarketNewsDigest', () => {
    beforeEach(() => {
        mockFetchMarketNewsDigest.mockReset();
        mockGetMarketNewsCardsAction.mockReset();
        mockEnsureMarketNewsCardsAnalyzedAction.mockReset();
        mockEnsureMarketNewsCardsAnalyzedAction.mockResolvedValue(undefined);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    it('isCardsReady=false → enabled=false, queryFn is NOT called', async () => {
        // hasEnrichedNews=false means isCardsReady starts false (polls via interval).
        // The cards waiter keeps isCardsReady=false until enriched cards appear,
        // so useQuery stays disabled and fetchMarketNewsDigest is not invoked.
        // Use fake timers so the 3s poll interval never fires during this test.
        vi.useFakeTimers();

        const { result } = renderHook(
            () => useMarketNewsDigest('general', false),
            { wrapper: makeWrapper() }
        );

        // Let synchronous effects (including hydration setState) flush.
        await act(async () => {
            await Promise.resolve();
        });

        expect(mockFetchMarketNewsDigest).not.toHaveBeenCalled();
        expect(result.current.status).toBe('loading');

        vi.useRealTimers();
    });

    it('waitError from cards waiter surfaces as status: error', async () => {
        // cards waiter polls getMarketNewsCardsAction on a 3s interval; make it
        // return ok: false MAX_CONSECUTIVE_FAILURES (3) times so waitError gets set.
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: false,
            error: 'DB unavailable',
        });
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

    // peekSeed는 쿼리의 초기 데이터다 — 시드가 있는 방문은 요청을 보내지 않고,
    // 화면에 있는 결과는 대기 실패보다 우선한다.
    const PEEK_SEED: NewsAnalysisResponse = {
        overallSentiment: 'neutral',
        currentDriverKo: '시드로 노출된 다이제스트입니다.',
        keyEventsKo: [],
        upcomingEventsKo: [],
    };

    it('(Happy) peekSeed 있음 → 첫 렌더부터 done이고 다이제스트 요청을 보내지 않는다', async () => {
        mockFetchMarketNewsDigest.mockResolvedValue(DIGEST_RESULT);

        const { result } = renderHook(
            () => useMarketNewsDigest('articles', true, PEEK_SEED),
            { wrapper: makeWrapper() }
        );

        expect(result.current).toMatchObject({
            status: 'done',
            result: PEEK_SEED,
        });

        // 하이드레이션 게이트와 쿼리 활성화가 모두 지나가도록 한 틱 흘린다.
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(mockFetchMarketNewsDigest).not.toHaveBeenCalled();
        expect(result.current).toMatchObject({
            status: 'done',
            result: PEEK_SEED,
        });
    });

    it('(Worst) waitError가 나도 peekSeed가 있으면 seed를 계속 보여 준다', async () => {
        mockGetMarketNewsCardsAction.mockResolvedValue({
            ok: false,
            error: 'DB unavailable',
        });
        vi.useFakeTimers();

        const { result } = renderHook(
            () => useMarketNewsDigest('general', false, PEEK_SEED),
            { wrapper: makeWrapper() }
        );

        for (let i = 0; i < 3; i++) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(3000);
            });
        }

        expect(result.current).toMatchObject({
            status: 'done',
            result: PEEK_SEED,
        });

        vi.useRealTimers();
    });

    it('(Happy) peekSeed 없음 → 기존과 동일하게 loading 상태를 그대로 노출', async () => {
        mockFetchMarketNewsDigest.mockImplementation(
            () => new Promise(() => {})
        );

        const { result, unmount } = renderHook(
            () => useMarketNewsDigest('articles', true),
            { wrapper: makeWrapper() }
        );

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(result.current.status).toBe('loading');
        expect(mockFetchMarketNewsDigest).toHaveBeenCalledTimes(1);

        unmount();
    });

    describe('카드 대기 실패', () => {
        const WAIT_FAIL_STEPS = 3;

        async function failWaitOnce(): Promise<void> {
            for (let i = 0; i < WAIT_FAIL_STEPS; i++) {
                await act(async () => {
                    await vi.advanceTimersByTimeAsync(3000);
                });
            }
        }

        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('화면에 보여 줄 원문 대신 지역화된 일반 문구를 쓰고 원문은 콘솔에만 남긴다', async () => {
            const consoleError = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            try {
                mockGetMarketNewsCardsAction.mockResolvedValue({
                    ok: false,
                    error: 'db error',
                });

                const { result } = renderHook(
                    () => useMarketNewsDigest('general', false),
                    { wrapper: makeWrapper() }
                );
                await failWaitOnce();

                if (result.current.status !== 'error')
                    throw new Error('expected error');
                expect(result.current.error.message).toBe(
                    'AI 다이제스트 생성 중 오류가 발생했어요.'
                );
                expect(consoleError).toHaveBeenCalledWith(
                    '[useWaitForMarketNewsCards] poll failed:',
                    expect.objectContaining({ message: 'db error' })
                );
            } finally {
                consoleError.mockRestore();
            }
        });

        it('retry()가 대기를 처음부터 다시 시작해 복구되고 수집 요청도 다시 보낸다', async () => {
            const consoleError = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            try {
                mockGetMarketNewsCardsAction.mockResolvedValue({
                    ok: false,
                    error: 'db error',
                });
                mockFetchMarketNewsDigest.mockResolvedValue(DIGEST_RESULT);

                const { result } = renderHook(
                    () => useMarketNewsDigest('general', false),
                    { wrapper: makeWrapper() }
                );
                await failWaitOnce();

                expect(result.current.status).toBe('error');
                expect(
                    mockEnsureMarketNewsCardsAnalyzedAction
                ).toHaveBeenCalledTimes(1);

                // 복구된 서버: 이제 보강된 카드가 온다.
                mockGetMarketNewsCardsAction.mockResolvedValue({
                    ok: true,
                    items: [ENRICHED_CARD],
                });
                const errorState = result.current;
                if (errorState.status !== 'error')
                    throw new Error('expected error');
                act(() => {
                    errorState.retry();
                });

                expect(result.current.status).toBe('loading');
                expect(
                    mockEnsureMarketNewsCardsAnalyzedAction
                ).toHaveBeenCalledTimes(2);

                await act(async () => {
                    await vi.advanceTimersByTimeAsync(4000);
                });

                expect(result.current).toMatchObject({
                    status: 'done',
                    result: DIGEST_RESULT,
                });
            } finally {
                consoleError.mockRestore();
            }
        });

        it('다이제스트가 이미 화면에 있으면 뒤늦은 대기 실패가 본문을 가리지 않는다', async () => {
            const consoleError = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            try {
                mockGetMarketNewsCardsAction.mockResolvedValue({
                    ok: false,
                    error: 'db error',
                });

                const { result } = renderHook(
                    () => useMarketNewsDigest('general', false, PEEK_SEED),
                    { wrapper: makeWrapper() }
                );
                await failWaitOnce();

                expect(result.current).toMatchObject({
                    status: 'done',
                    result: PEEK_SEED,
                });
            } finally {
                consoleError.mockRestore();
            }
        });
    });
});
