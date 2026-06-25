import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Timeframe } from '@y0ngha/siglens-core';
import { useTimeframeChange } from '@/views/symbol/hooks/useTimeframeChange';

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
        const { result } = renderHook(() => useTimeframeChange('AAPL'), {
            wrapper: makeWrapper(),
        });

        expect(result.current.timeframe).toBe('1Day');
    });

    it('reads timeframe from search param', () => {
        mockGet.mockReturnValue('1Week');

        const { result } = renderHook(() => useTimeframeChange('AAPL'), {
            wrapper: makeWrapper(),
        });

        expect(result.current.timeframe).toBe('1Week');
    });

    it('falls back to DEFAULT_TIMEFRAME for invalid search param', () => {
        mockGet.mockReturnValue('invalid');

        const { result } = renderHook(() => useTimeframeChange('AAPL'), {
            wrapper: makeWrapper(),
        });

        expect(result.current.timeframe).toBe('1Day');
    });

    it('starts with timeframeChangeCount of 0', () => {
        const { result } = renderHook(() => useTimeframeChange('AAPL'), {
            wrapper: makeWrapper(),
        });

        expect(result.current.timeframeChangeCount).toBe(0);
    });

    it('skips change when next timeframe equals current', () => {
        const { result } = renderHook(() => useTimeframeChange('AAPL'), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.handleTimeframeChange('1Day' as Timeframe);
        });

        expect(mockReplace).not.toHaveBeenCalled();
    });
});
