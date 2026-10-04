// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { useMarketSummary } from '@/widgets/dashboard/hooks/useMarketSummary';
import { getMarketSummaryClientAction } from '@/entities/market-summary/actions/getMarketSummaryClientAction';
import { marketSummarySeed } from '@/entities/market-summary/lib/marketSummarySeed';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

vi.mock(
    '@/entities/market-summary/actions/getMarketSummaryClientAction',
    () => ({
        getMarketSummaryClientAction: vi.fn(),
    })
);

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
        const { result } = renderHook(() => useMarketSummary('us'), {
            wrapper,
        });
        expect(result.current.isPending).toBe(true);
        client.clear();
    });

    it('(Happy) returns data with sectorMap and indices when action resolves', async () => {
        mockAction.mockResolvedValue(SUMMARY_DATA);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketSummary('us'), {
            wrapper,
        });

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
        const { result } = renderHook(() => useMarketSummary('us'), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isPending).toBe(false);
        });

        expect(result.current.hasMissingQuotes).toBe(true);
        client.clear();
    });

    it('(Worst) {ok:false} → empty sectorMap and indices', async () => {
        mockAction.mockResolvedValue({ ok: false, error: 'server_error' });
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useMarketSummary('us'), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isPending).toBe(false);
        });

        expect(result.current.sectorMap.size).toBe(0);
        expect(result.current.indices).toHaveLength(0);
        expect(result.current.hasMissingQuotes).toBe(false);
        client.clear();
    });

    it('(Worst-E2E) isE2EClient=true → staleTime 0 적용 (즉시 refetch)', async () => {
        // IS_E2E_MODE is a module-level const — use vi.doMock (non-hoisted) + vi.resetModules
        // + dynamic import so the module is re-evaluated with isE2EClient returning true.
        vi.resetModules();
        vi.doMock('@/shared/api/e2eClientEnv', () => ({
            isE2EClient: vi.fn(() => true),
        }));
        vi.doMock(
            '@/entities/market-summary/actions/getMarketSummaryClientAction',
            () => ({
                getMarketSummaryClientAction: vi.fn(),
            })
        );
        // Also re-mock useHydrated so the query is enabled in the reloaded module context.
        vi.doMock('@/shared/hooks/useHydrated', () => ({
            useHydrated: vi.fn(() => true),
        }));

        const { useMarketSummary: useMarketSummaryE2E } =
            await import('@/widgets/dashboard/hooks/useMarketSummary');
        const { getMarketSummaryClientAction: e2eMockAction } =
            await import('@/entities/market-summary/actions/getMarketSummaryClientAction');
        (e2eMockAction as ReturnType<typeof vi.fn>).mockResolvedValue(
            SUMMARY_DATA
        );

        const { client, wrapper } = makeWrapper();
        renderHook(() => useMarketSummaryE2E('us'), { wrapper });

        // When staleTime=0 and refetchOnMount='always', data immediately becomes stale
        // so the query refetches. Action called at least once.
        await waitFor(() => {
            expect(e2eMockAction).toHaveBeenCalled();
        });

        client.clear();
        vi.doUnmock('@/shared/api/e2eClientEnv');
        vi.doUnmock(
            '@/entities/market-summary/actions/getMarketSummaryClientAction'
        );
        vi.doUnmock('@/shared/hooks/useHydrated');
    });

    /**
     * 서버가 심은 시드가 **fetch 전에** 화면에 쓰이는가. 크롤러가 받는 서버 HTML과
     * 첫 페인트가 여기에 달려 있다 — 시드가 버려지면 카드가 fetch 뒤에야 생기며 아래를
     * 밀어낸다. 시드는 손으로 만들지 않고 서버가 쓰는 `marketSummarySeed`로 만든다.
     */
    describe('서버 시드', () => {
        it.each(['us', 'kr'] as const)(
            '%s: 시드만으로 지수·섹터가 나온다',
            scope => {
                mockAction.mockImplementation(() => new Promise(() => {}));
                const { client, wrapper } = makeWrapper();
                client.setQueryData(
                    QUERY_KEYS.marketSummary(scope),
                    marketSummarySeed(scope, SUMMARY_DATA.summary)
                );

                const { result } = renderHook(() => useMarketSummary(scope), {
                    wrapper,
                });

                expect(result.current.isPending).toBe(false);
                expect(result.current.indices).toHaveLength(1);
                expect(result.current.sectorMap.get('XLK')).toBeDefined();
                client.clear();
            }
        );

        it('kr: scope를 밝히지 않은 데이터는 쓰지 않는다 — 구 컨테이너의 미국 응답일 수 있다', () => {
            mockAction.mockImplementation(() => new Promise(() => {}));
            const { client, wrapper } = makeWrapper();
            client.setQueryData(QUERY_KEYS.marketSummary('kr'), SUMMARY_DATA);

            const { result } = renderHook(() => useMarketSummary('kr'), {
                wrapper,
            });

            expect(result.current.indices).toHaveLength(0);
            client.clear();
        });
    });
});
