// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { useMarketSummary } from '@/widgets/dashboard/hooks/useMarketSummary';
import { getMarketSummaryAction } from '@/entities/market-summary/actions';

vi.mock('@/entities/market-summary/actions', () => ({
    getMarketSummaryAction: vi.fn(),
}));

const mockAction = getMarketSummaryAction as ReturnType<typeof vi.fn>;

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
    briefing: null,
};

describe('useMarketSummary', () => {
    afterEach(() => {
        mockAction.mockReset();
    });

    it('returns isPending true initially', () => {
        mockAction.mockImplementation(() => new Promise(() => {}));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketSummary(), { wrapper });
        expect(result.current.isPending).toBe(true);
        client.clear();
    });

    it('returns data with sectorMap and indices when action resolves', async () => {
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
        client.clear();
    });

    it('returns empty sectorMap and indices when action returns error shape', async () => {
        mockAction.mockResolvedValue({ ok: false });
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketSummary(), { wrapper });

        await waitFor(() => {
            expect(result.current.isPending).toBe(false);
        });

        expect(result.current.sectorMap.size).toBe(0);
        expect(result.current.indices).toHaveLength(0);
        client.clear();
    });
});
