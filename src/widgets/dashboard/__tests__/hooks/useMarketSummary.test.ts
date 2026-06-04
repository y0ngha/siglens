// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { useMarketSummary } from '@/widgets/dashboard/hooks/useMarketSummary';
import { getMarketSummaryClientAction } from '@/entities/market-summary/actions';

vi.mock('@/entities/market-summary/actions', () => ({
    getMarketSummaryClientAction: vi.fn(),
}));

vi.mock('@/shared/api/e2eClientEnv', () => ({
    isE2EClient: vi.fn(() => false),
}));

const mockAction = getMarketSummaryClientAction as ReturnType<typeof vi.fn>;

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return {
        client,
        wrapper: ({ children }: { children: ReactNode }) =>
            createElement(QueryClientProvider, { client }, children),
    };
}

const SUMMARY_DATA = {
    summary: {
        indices: [
            {
                symbol: 'SPY',
                fmpSymbol: '^GSPC',
                koreanName: 'S&P 500',
                displayName: 'S&P 500',
                price: 5000,
                changesPercentage: 1.5,
            },
        ],
        sectors: [
            {
                symbol: 'XLK',
                sectorName: 'Technology',
                koreanName: '기술',
                price: 200,
                changesPercentage: 2.0,
            },
        ],
    },
};

describe('useMarketSummary', () => {
    afterEach(() => {
        mockAction.mockReset();
    });

    it('(Happy) isPending true initially', () => {
        mockAction.mockImplementation(() => new Promise(() => {}));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketSummary(), { wrapper });
        expect(result.current.isPending).toBe(true);
        client.clear();
    });

    it('(Happy) returns data with sectorMap and indices when action resolves', async () => {
        mockAction.mockResolvedValue(SUMMARY_DATA);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketSummary(), { wrapper });

        await waitFor(() => {
            expect(result.current.isPending).toBe(false);
        });

        expect(result.current.data).toEqual(SUMMARY_DATA);
        expect(result.current.sectorMap.get('XLK')).toBeDefined();
        expect(result.current.indices).toHaveLength(1);
        expect(result.current.indices[0]?.symbol).toBe('SPY');
        expect(result.current.hasMissingQuotes).toBe(false);
        client.clear();
    });

    it('(Worst) 0-price summary → hasMissingQuotes=true', async () => {
        mockAction.mockResolvedValue({
            summary: {
                indices: SUMMARY_DATA.summary.indices,
                sectors: [
                    {
                        ...SUMMARY_DATA.summary.sectors[0],
                        price: 0,
                        changesPercentage: 0,
                    },
                ],
            },
        });
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketSummary(), { wrapper });

        await waitFor(() => {
            expect(result.current.isPending).toBe(false);
        });

        expect(result.current.hasMissingQuotes).toBe(true);
        client.clear();
    });

    it('(Worst) {ok:false} → empty sectorMap and indices', async () => {
        mockAction.mockResolvedValue({ ok: false, error: 'server_error' });
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketSummary(), { wrapper });

        await waitFor(() => {
            expect(result.current.isPending).toBe(false);
        });

        expect(result.current.sectorMap.size).toBe(0);
        expect(result.current.indices).toHaveLength(0);
        expect(result.current.hasMissingQuotes).toBe(false);
        client.clear();
    });

    it('(Worst-E2E) isE2EClient=true → staleTime 0 적용 (즉시 refetch)', async () => {
        const { isE2EClient } = await import('@/shared/api/e2eClientEnv');
        (isE2EClient as ReturnType<typeof vi.fn>).mockReturnValue(true);

        mockAction.mockResolvedValue(SUMMARY_DATA);
        const { client, wrapper } = makeWrapper();
        renderHook(() => useMarketSummary(), { wrapper });

        // When staleTime=0 and refetchOnMount='always', data immediately becomes stale
        // so the query refetches. Action called at least once.
        await waitFor(() => {
            expect(mockAction).toHaveBeenCalled();
        });

        client.clear();
        // Reset mock
        (isE2EClient as ReturnType<typeof vi.fn>).mockReturnValue(false);
    });
});
