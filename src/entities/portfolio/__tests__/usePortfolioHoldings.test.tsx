vi.mock('@/entities/portfolio/actions', () => ({
    getPortfolioHoldingsAction: vi.fn(),
    savePortfolioHoldingAction: vi.fn(),
    deletePortfolioHoldingAction: vi.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
    deletePortfolioHoldingAction,
    getPortfolioHoldingsAction,
    savePortfolioHoldingAction,
} from '@/entities/portfolio/actions';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import type { PortfolioHoldingView } from '@/entities/portfolio/model';

const mockGetPortfolioHoldingsAction = getPortfolioHoldingsAction as ReturnType<
    typeof vi.fn
>;
const mockSavePortfolioHoldingAction = savePortfolioHoldingAction as ReturnType<
    typeof vi.fn
>;
const mockDeletePortfolioHoldingAction =
    deletePortfolioHoldingAction as ReturnType<typeof vi.fn>;

const HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10',
    averagePrice: '150.5',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
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

describe('usePortfolioHoldings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetPortfolioHoldingsAction.mockResolvedValue([]);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(c => c.clear());
    });

    it('holdings starts empty while loading, then reflects the fetched list', async () => {
        mockGetPortfolioHoldingsAction.mockResolvedValue([HOLDING]);

        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        expect(result.current.holdings).toEqual([]);

        await waitFor(() => {
            expect(result.current.holdings).toEqual([HOLDING]);
        });
    });

    it('save.mutateAsync calls savePortfolioHoldingAction and invalidates the list on success', async () => {
        mockSavePortfolioHoldingAction.mockResolvedValue({
            status: 'ok',
            holding: HOLDING,
        });
        mockGetPortfolioHoldingsAction
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([HOLDING]);

        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const input = { symbol: 'AAPL', quantity: '10', averagePrice: '150.5' };
        await act(async () => {
            await result.current.save.mutateAsync(input);
        });

        expect(mockSavePortfolioHoldingAction).toHaveBeenCalledWith(input);
        await waitFor(() => {
            expect(mockGetPortfolioHoldingsAction).toHaveBeenCalledTimes(2);
        });
        await waitFor(() => {
            expect(result.current.holdings).toEqual([HOLDING]);
        });
    });

    it('save.mutateAsync does NOT invalidate when the action returns an error result', async () => {
        mockSavePortfolioHoldingAction.mockResolvedValue({
            status: 'error',
            code: 'invalid_symbol',
            message: '올바른 종목 코드를 입력해 주세요.',
        });

        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.save.mutateAsync({
                symbol: '!!!',
                quantity: '10',
                averagePrice: '150.5',
            });
        });

        expect(mockGetPortfolioHoldingsAction).toHaveBeenCalledTimes(1);
    });

    it('exposes isError: false on a successful fetch', async () => {
        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isError).toBe(false);
    });

    it('exposes isError: true and an empty holdings list when the read fails, and refetch() re-invokes the query', async () => {
        mockGetPortfolioHoldingsAction
            .mockRejectedValueOnce(new Error('DB connection failed'))
            .mockResolvedValueOnce([HOLDING]);

        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.holdings).toEqual([]);

        result.current.refetch();

        await waitFor(() => expect(result.current.isError).toBe(false));
        expect(result.current.holdings).toEqual([HOLDING]);
    });

    it('remove.mutateAsync calls deletePortfolioHoldingAction and invalidates the list on success', async () => {
        mockDeletePortfolioHoldingAction.mockResolvedValue({ status: 'ok' });
        mockGetPortfolioHoldingsAction
            .mockResolvedValueOnce([HOLDING])
            .mockResolvedValueOnce([]);

        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.remove.mutateAsync('AAPL');
        });

        expect(mockDeletePortfolioHoldingAction).toHaveBeenCalledWith('AAPL');
        await waitFor(() => {
            expect(mockGetPortfolioHoldingsAction).toHaveBeenCalledTimes(2);
        });
        await waitFor(() => {
            expect(result.current.holdings).toEqual([]);
        });
    });

    it('remove.mutateAsync does NOT invalidate when the action returns an error result', async () => {
        mockDeletePortfolioHoldingAction.mockResolvedValue({
            status: 'error',
            code: 'unknown',
            message: '삭제에 실패했어요. 다시 시도해 주세요.',
        });
        mockGetPortfolioHoldingsAction.mockResolvedValue([HOLDING]);

        const { result } = renderHook(() => usePortfolioHoldings(), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.remove.mutateAsync('AAPL');
        });

        expect(mockGetPortfolioHoldingsAction).toHaveBeenCalledTimes(1);
        expect(result.current.holdings).toEqual([HOLDING]);
    });
});
