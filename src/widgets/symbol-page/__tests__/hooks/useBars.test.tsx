import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBars } from '@/widgets/symbol-page/hooks/useBars';
import type { BarsData, Timeframe } from '@y0ngha/siglens-core';

vi.mock('@/entities/bars/actions', () => ({
    getBarsAction: vi.fn(),
}));

import { getBarsAction } from '@/entities/bars/actions';

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
});
