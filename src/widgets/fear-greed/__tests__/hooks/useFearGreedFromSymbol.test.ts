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
});
