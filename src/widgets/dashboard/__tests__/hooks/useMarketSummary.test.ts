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
        expect(result.current.hasMissingQuotes).toBe(false);
        // briefing이 null이면 undefined로 합쳐 노출한다.
        expect(result.current.briefing).toBeUndefined();
        client.clear();
    });

    it('briefing 결과를 그대로 노출한다(cached)', async () => {
        const cached = {
            status: 'cached',
            briefing: 'AI briefing',
            generatedAt: '2025-01-01T00:00:00Z',
        };
        mockAction.mockResolvedValue({ ...SUMMARY_DATA, briefing: cached });
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketSummary(), { wrapper });

        await waitFor(() => {
            expect(result.current.isPending).toBe(false);
        });

        expect(result.current.briefing).toEqual(cached);
        client.clear();
    });

    it('일부 종목 price=0이면 hasMissingQuotes=true', async () => {
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
            briefing: null,
        });
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketSummary(), { wrapper });

        await waitFor(() => {
            expect(result.current.isPending).toBe(false);
        });

        expect(result.current.hasMissingQuotes).toBe(true);
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
        expect(result.current.hasMissingQuotes).toBe(false);
        client.clear();
    });
});
