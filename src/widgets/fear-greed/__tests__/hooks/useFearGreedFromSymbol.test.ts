// @vitest-environment jsdom
const { mockAction } = vi.hoisted(() => ({
    mockAction: vi.fn(),
}));
vi.mock('@/entities/bars/actions/getSymbolFearGreedAction', () => ({
    getSymbolFearGreedAction: mockAction,
}));

import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { useFearGreedFromSymbol } from '../../hooks/useFearGreedFromSymbol';

const SERVER_RESULT = {
    snapshot: { score: 58, label: 'GREED' },
    history: [{ date: '2026-10-02', score: 58, label: 'GREED' }],
};

function wrapperWith(client: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return createElement(QueryClientProvider, { client }, children);
    };
}

/**
 * 게이지는 클라이언트에서 계산하지 않는다 — 서버가 5년 일봉으로 계산한 결과를 받는다.
 * 클라이언트가 2년 봉으로 다시 계산하면 헤더 배지·요약과 같은 날 점수가 달라진다.
 */
describe('useFearGreedFromSymbol', () => {
    afterEach(() => {
        mockAction.mockReset();
    });

    it('서버 액션에 종목과 fmpSymbol을 넘기고 그 결과를 그대로 돌려준다', async () => {
        mockAction.mockResolvedValue(SERVER_RESULT);
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        const { result } = renderHook(
            () =>
                useFearGreedFromSymbol({
                    symbol: 'AAPL',
                    fmpSymbol: 'aapl-fmp',
                }),
            { wrapper: wrapperWith(client) }
        );

        await waitFor(() => expect(result.current).toEqual(SERVER_RESULT));
        expect(mockAction).toHaveBeenCalledWith('AAPL', 'aapl-fmp');
    });

    it('페이지가 seed한 서버 계산값이 있으면 그 값을 먼저 쓴다', () => {
        const client = new QueryClient();
        client.setQueryData(
            QUERY_KEYS.symbolFearGreed('NVDA', undefined),
            SERVER_RESULT,
            { updatedAt: Date.now() }
        );

        const { result } = renderHook(
            () => useFearGreedFromSymbol({ symbol: 'NVDA' }),
            { wrapper: wrapperWith(client) }
        );

        expect(result.current).toEqual(SERVER_RESULT);
        expect(mockAction).not.toHaveBeenCalled();
    });

    /**
     * seed의 `dataUpdatedAt`이 오래돼 있으면 30초 staleTime에서 마운트 직후 재조회가 돈다.
     * 크롤러 렌더마다 나가던 Server Action이라 사람 입력 전에는 미루고, 입력 뒤 한 번만 돈다.
     */
    describe('refetchEnabled (seed 재조회 게이트)', () => {
        function seededClient(): QueryClient {
            const client = new QueryClient({
                defaultOptions: { queries: { retry: false } },
            });
            client.setQueryData(
                QUERY_KEYS.symbolFearGreed('NVDA', undefined),
                SERVER_RESULT,
                { updatedAt: 1_000 }
            );
            return client;
        }

        beforeEach(() => {
            // 기본은 거부 — 값을 정하지 않은 호출이 조용히 성공하지 않게.
            mockAction.mockRejectedValue(new Error('action not stubbed'));
        });

        it('false인 동안은 오래된 seed가 있어도 재조회하지 않는다', async () => {
            const { result } = renderHook(
                () =>
                    useFearGreedFromSymbol({
                        symbol: 'NVDA',
                        refetchEnabled: false,
                    }),
                { wrapper: wrapperWith(seededClient()) }
            );
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(result.current).toEqual(SERVER_RESULT);
            expect(mockAction).not.toHaveBeenCalled();
        });

        it('true로 바뀌면 stale seed를 정확히 한 번 재조회한다', async () => {
            mockAction.mockResolvedValue(SERVER_RESULT);
            const { rerender } = renderHook(
                ({ enabled }: { enabled: boolean }) =>
                    useFearGreedFromSymbol({
                        symbol: 'NVDA',
                        refetchEnabled: enabled,
                    }),
                {
                    wrapper: wrapperWith(seededClient()),
                    initialProps: { enabled: false },
                }
            );
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(mockAction).not.toHaveBeenCalled();

            rerender({ enabled: true });
            await waitFor(() => expect(mockAction).toHaveBeenCalledTimes(1));

            rerender({ enabled: true });
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(mockAction).toHaveBeenCalledTimes(1);
        });
    });
});
