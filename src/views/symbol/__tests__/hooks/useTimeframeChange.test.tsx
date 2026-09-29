import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Timeframe } from '@y0ngha/siglens-core';
import { useTimeframeChange } from '@/views/symbol/hooks/useTimeframeChange';
import { getBarsAction } from '@/entities/bars/actions/getBarsAction';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';

const mockGet = vi.fn().mockReturnValue(null);

vi.mock('next/navigation', () => ({
    useSearchParams: () => ({ get: mockGet }),
}));

vi.mock('@/shared/config/market', () => ({
    DEFAULT_TIMEFRAME: '1Day',
    isValidTimeframe: (v: unknown) =>
        ['1Day', '1Week', '1Month'].includes(v as string),
}));

vi.mock('@/entities/bars/actions/getBarsAction', () => ({
    getBarsAction: vi.fn().mockResolvedValue({ bars: [], indicators: {} }),
}));

vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(() => undefined),
}));

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

describe('useTimeframeChange', () => {
    // Timeframe changes go through window.history.replaceState (Next syncs
    // useSearchParams from it) instead of router.replace, so this spy is the
    // "navigation" under test.
    let mockReplace: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        mockReplace = vi.spyOn(window.history, 'replaceState');
        mockGet.mockReturnValue(null);
    });

    afterEach(() => {
        mockReplace.mockRestore();
        queryClients.splice(0).forEach(c => c.clear());
    });

    it('defaults to DEFAULT_TIMEFRAME when search param is absent', () => {
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            {
                wrapper: makeWrapper(),
            }
        );

        expect(result.current.timeframe).toBe('1Day');
    });

    it('reads timeframe from search param', () => {
        mockGet.mockReturnValue('1Week');

        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            {
                wrapper: makeWrapper(),
            }
        );

        expect(result.current.timeframe).toBe('1Week');
    });

    it('falls back to DEFAULT_TIMEFRAME for invalid search param', () => {
        mockGet.mockReturnValue('invalid');

        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            {
                wrapper: makeWrapper(),
            }
        );

        expect(result.current.timeframe).toBe('1Day');
    });

    it('starts with timeframeChangeCount of 0', () => {
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            {
                wrapper: makeWrapper(),
            }
        );

        expect(result.current.timeframeChangeCount).toBe(0);
    });

    it('skips change when next timeframe equals current', () => {
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            {
                wrapper: makeWrapper(),
            }
        );

        act(() => {
            result.current.handleTimeframeChange('1Day' as Timeframe);
        });

        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('canonicalizes a non-1Day query for a hydrated free user via history.replaceState', () => {
        mockGet.mockReturnValue('1Week');
        // Canonicalization uses window.history.replaceState (not router.replace):
        // the server ignores `tf`, so a router.replace() RSC round-trip is both
        // wasteful and race-droppable from this mount-time effect. history
        // .replaceState is synchronous and Next syncs useSearchParams from it.

        const { result } = renderHook(
            () => useTimeframeChange('AAPL', true, true),
            {
                wrapper: makeWrapper(),
            }
        );

        expect(result.current.timeframe).toBe('1Day');
        expect(mockReplace).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith(null, '', '/AAPL?tf=1Day');
    });

    it('uses 1Day until the user tier has hydrated', () => {
        mockGet.mockReturnValue('1Week');

        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, false),
            {
                wrapper: makeWrapper(),
            }
        );

        expect(result.current.timeframe).toBe('1Day');
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('does not navigate, prefetch, or change timeframe before tier hydration', () => {
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, false),
            {
                wrapper: makeWrapper(),
            }
        );

        act(() => {
            result.current.handleTimeframeChange('1Week' as Timeframe);
        });

        expect(mockReplace).not.toHaveBeenCalled();
        expect(getBarsAction).not.toHaveBeenCalled();
        expect(result.current.timeframeChangeCount).toBe(0);
    });

    it('is a no-op when a hydrated free user requests a non-default timeframe', () => {
        // Mirrors the pre-hydration no-op test above, but exercises the
        // separate `isFreeTier && nextTimeframe !== DEFAULT_TIMEFRAME` guard
        // inside handleTimeframeChange, which applies even after hydration.
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', true, true),
            {
                wrapper: makeWrapper(),
            }
        );

        act(() => {
            result.current.handleTimeframeChange('1Week' as Timeframe);
        });

        expect(mockReplace).not.toHaveBeenCalled();
        expect(getBarsAction).not.toHaveBeenCalled();
        expect(result.current.timeframeChangeCount).toBe(0);
    });

    it('restores a member query timeframe after hydration and refreshes analysis once', async () => {
        mockGet.mockReturnValue('1Week');

        const { result, rerender } = renderHook(
            ({ isTierHydrated }: { isTierHydrated: boolean }) =>
                useTimeframeChange('AAPL', false, isTierHydrated),
            {
                wrapper: makeWrapper(),
                initialProps: { isTierHydrated: false },
            }
        );

        expect(result.current.timeframe).toBe('1Day');
        expect(result.current.timeframeChangeCount).toBe(0);

        rerender({ isTierHydrated: true });

        await waitFor(() => {
            expect(result.current.timeframe).toBe('1Week');
            expect(result.current.timeframeChangeCount).toBe(1);
        });
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('prefetches bars and navigates when a member picks a new timeframe', async () => {
        const { result } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            {
                wrapper: makeWrapper(),
            }
        );

        act(() => {
            result.current.handleTimeframeChange('1Week' as Timeframe);
        });

        // The prefetch must be issued from the event handler, not during render:
        // useSuspenseQuery calling a Server Action mid-render collides with
        // Next's internal router state update.
        await waitFor(() => {
            expect(getBarsAction).toHaveBeenCalledWith(
                'AAPL',
                '1Week',
                undefined
            );
        });
        expect(mockReplace).toHaveBeenCalledWith(null, '', '/AAPL?tf=1Week');
        await waitFor(() => {
            expect(result.current.timeframeChangeCount).toBe(1);
        });
    });

    it('passes the resolved fmpSymbol into the prefetch query key', async () => {
        vi.mocked(useAssetInfo).mockReturnValueOnce({
            fmpSymbol: 'BTCUSD',
        } as ReturnType<typeof useAssetInfo>);

        const { result } = renderHook(
            () => useTimeframeChange('BTC', false, true),
            {
                wrapper: makeWrapper(),
            }
        );

        act(() => {
            result.current.handleTimeframeChange('1Week' as Timeframe);
        });

        await waitFor(() => {
            expect(getBarsAction).toHaveBeenCalledWith(
                'BTC',
                '1Week',
                'BTCUSD'
            );
        });
    });

    it('does not double-count when the URL catches up to a navigation it initiated', async () => {
        const { result, rerender } = renderHook(
            () => useTimeframeChange('AAPL', false, true),
            {
                wrapper: makeWrapper(),
            }
        );

        act(() => {
            result.current.handleTimeframeChange('1Week' as Timeframe);
        });

        // The selector flips immediately while the chart keeps the old bars.
        expect(result.current.displayTimeframe).toBe('1Week');
        expect(result.current.isTimeframeSwitching).toBe(true);

        await waitFor(() => {
            expect(result.current.timeframeChangeCount).toBe(1);
        });

        // useSearchParams is mocked, so simulate the search param landing after
        // the transition. The pending-navigation ref must absorb this so the
        // count stays at 1 — an extra increment would re-trigger the analysis
        // refresh for a timeframe change the user only made once.
        mockGet.mockReturnValue('1Week');
        rerender();

        await waitFor(() => {
            expect(result.current.timeframe).toBe('1Week');
        });
        expect(result.current.timeframeChangeCount).toBe(1);
        expect(result.current.isTimeframeSwitching).toBe(false);
        expect(result.current.displayTimeframe).toBe('1Week');
    });

    /**
     * pending을 "목적지에 도착했는가"(`pending.to === timeframe`)로만 풀면, 전환
     * 도중 timeframe이 그 목적지가 **아닌** 다른 값으로 강제로 바뀌는 경우(로그아웃
     * 등으로 tier가 free로 떨어져 DEFAULT_TIMEFRAME으로 강등)에 스피너가 영영
     * 풀리지 않는다. `from`(전환을 시작한 시점의 timeframe)과 달라졌는지로 풀어야
     * 이 경우도 잡는다.
     */
    it('전환 도중 tier가 free로 떨어져 timeframe이 강제로 바뀌면 pending이 풀린다', () => {
        mockGet.mockReturnValue('1Week');

        const { result, rerender } = renderHook(
            ({ isFreeTier }: { isFreeTier: boolean }) =>
                useTimeframeChange('AAPL', isFreeTier, true),
            {
                wrapper: makeWrapper(),
                initialProps: { isFreeTier: false },
            }
        );

        expect(result.current.timeframe).toBe('1Week');

        act(() => {
            result.current.handleTimeframeChange('1Month' as Timeframe);
        });

        expect(result.current.isTimeframeSwitching).toBe(true);
        expect(result.current.displayTimeframe).toBe('1Month');

        // 로그아웃 등으로 free tier로 강등 — timeframe이 목적지(1Month)가 아니라
        // DEFAULT_TIMEFRAME(1Day)으로 강제된다. 시작 시점(1Week)과는 달라졌으므로
        // pending은 여기서 풀려야 한다.
        rerender({ isFreeTier: true });

        expect(result.current.timeframe).toBe('1Day');
        expect(result.current.isTimeframeSwitching).toBe(false);
        expect(result.current.displayTimeframe).toBe('1Day');
    });
});
