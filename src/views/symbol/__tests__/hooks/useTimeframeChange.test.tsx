import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Timeframe } from '@y0ngha/siglens-core';
import { useTimeframeChange } from '@/views/symbol/hooks/useTimeframeChange';
import { getBarsAction } from '@/entities/bars/actions';

const mockReplace = vi.fn();
const mockGet = vi.fn().mockReturnValue(null);

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace }),
    useSearchParams: () => ({ get: mockGet }),
}));

vi.mock('@/shared/config/market', () => ({
    DEFAULT_TIMEFRAME: '1Day',
    isValidTimeframe: (v: unknown) =>
        ['1Day', '1Week', '1Month'].includes(v as string),
}));

vi.mock('@/entities/bars/actions', () => ({
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
    beforeEach(() => {
        mockReplace.mockClear();
        mockGet.mockReturnValue(null);
    });

    afterEach(() => {
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
        const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

        const { result } = renderHook(
            () => useTimeframeChange('AAPL', true, true),
            {
                wrapper: makeWrapper(),
            }
        );

        expect(result.current.timeframe).toBe('1Day');
        expect(mockReplace).not.toHaveBeenCalled();
        expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/AAPL?tf=1Day');

        replaceStateSpy.mockRestore();
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
});
