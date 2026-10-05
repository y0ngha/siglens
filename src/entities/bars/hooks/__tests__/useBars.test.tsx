vi.mock('@/entities/bars/actions/getBarsAction', () => ({
    getBarsAction: vi.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getBarsAction } from '@/entities/bars/actions/getBarsAction';
import { useBars } from '@/entities/bars/hooks/useBars';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import type { BarsData, Timeframe } from '@y0ngha/siglens-core';

const MOCK_BARS_DATA: BarsData = {
    bars: [
        { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 500 },
    ],
    indicators: {
        buySellVolume: [],
    },
} as unknown as BarsData;

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
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

describe('useBars', () => {
    afterEach(() => {
        queryClients.splice(0).forEach(c => c.clear());
    });

    it('returns bars and indicators after fetch resolves', async () => {
        (getBarsAction as ReturnType<typeof vi.fn>).mockResolvedValue(
            MOCK_BARS_DATA
        );

        const { result } = renderHook(
            () =>
                useBars({
                    symbol: 'AAPL',
                    timeframe: '1Day' as Timeframe,
                }),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.bars).toEqual(MOCK_BARS_DATA.bars);
            expect(result.current.indicators).toEqual(
                MOCK_BARS_DATA.indicators
            );
        });
    });

    it('passes fmpSymbol to the action', async () => {
        (getBarsAction as ReturnType<typeof vi.fn>).mockResolvedValue(
            MOCK_BARS_DATA
        );

        renderHook(
            () =>
                useBars({
                    symbol: 'AAPL',
                    timeframe: '1Day' as Timeframe,
                    fmpSymbol: 'AAPL.US',
                }),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(getBarsAction).toHaveBeenCalledWith(
                'AAPL',
                '1Day',
                'AAPL.US'
            );
        });
    });

    /**
     * 서버 seed의 축소 지표를 전체로 복원하는 재조회는 의도된 동작이지만, 크롤러 렌더마다
     * Server Action POST를 만든다. 사람 입력 전에는 미루고, 입력 뒤 정확히 한 번만 돈다.
     */
    describe('refetchEnabled (seed 복원 재조회 게이트)', () => {
        const SEED_UPDATED_AT = 1_000; // 아주 오래 전 — 30초 staleTime에는 항상 stale.

        function renderSeeded(initial: { enabled: boolean }) {
            const client = new QueryClient({
                defaultOptions: { queries: { retry: false } },
            });
            queryClients.push(client);
            client.setQueryData(
                QUERY_KEYS.bars('AAPL', '1Day' as Timeframe, undefined),
                MOCK_BARS_DATA,
                { updatedAt: SEED_UPDATED_AT }
            );
            const wrapper = ({ children }: { children: ReactNode }) => (
                <QueryClientProvider client={client}>
                    {children}
                </QueryClientProvider>
            );
            return renderHook(
                ({ enabled }: { enabled: boolean }) =>
                    useBars({
                        symbol: 'AAPL',
                        timeframe: '1Day' as Timeframe,
                        refetchEnabled: enabled,
                    }),
                { wrapper, initialProps: initial }
            );
        }

        beforeEach(() => {
            vi.mocked(getBarsAction).mockReset();
            // 기본은 거부 — 값을 정하지 않은 호출이 조용히 성공하지 않게.
            vi.mocked(getBarsAction).mockRejectedValue(
                new Error('getBarsAction not stubbed')
            );
        });

        it('false인 동안은 seed가 있어도 마운트 재조회를 하지 않는다', async () => {
            const { result } = renderSeeded({ enabled: false });
            // RQ의 마운트 재조회는 마이크로태스크 안에서 시작된다 — 한 틱 기다린 뒤 확인한다.
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(result.current.bars).toEqual(MOCK_BARS_DATA.bars);
            expect(getBarsAction).not.toHaveBeenCalled();
        });

        it('true로 바뀌면 stale seed를 정확히 한 번 재조회한다', async () => {
            vi.mocked(getBarsAction).mockResolvedValue(MOCK_BARS_DATA);
            const { rerender } = renderSeeded({ enabled: false });
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(getBarsAction).not.toHaveBeenCalled();

            rerender({ enabled: true });
            await waitFor(() => expect(getBarsAction).toHaveBeenCalledTimes(1));

            // 이후 렌더가 더 있어도 추가 요청은 없다.
            rerender({ enabled: true });
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(getBarsAction).toHaveBeenCalledTimes(1);
        });

        it('처음부터 true면 마운트 재조회가 한 번만 일어난다 (전환 effect가 중복 요청하지 않는다)', async () => {
            vi.mocked(getBarsAction).mockResolvedValue(MOCK_BARS_DATA);
            renderSeeded({ enabled: true });
            await waitFor(() => expect(getBarsAction).toHaveBeenCalledTimes(1));
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(getBarsAction).toHaveBeenCalledTimes(1);
        });

        it('seed가 없으면 false여도 일반 조회는 돈다', async () => {
            vi.mocked(getBarsAction).mockResolvedValue(MOCK_BARS_DATA);
            const { result } = renderHook(
                () =>
                    useBars({
                        symbol: 'AAPL',
                        timeframe: '1Day' as Timeframe,
                        refetchEnabled: false,
                    }),
                { wrapper: makeWrapper() }
            );
            await waitFor(() =>
                expect(result.current.bars).toEqual(MOCK_BARS_DATA.bars)
            );
            expect(getBarsAction).toHaveBeenCalledTimes(1);
        });
    });
});
