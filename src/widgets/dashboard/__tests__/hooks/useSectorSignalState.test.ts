// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useSectorSignalState } from '@/widgets/dashboard/hooks/useSectorSignalState';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace }),
    usePathname: () => '/dashboard',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/entities/analysis', () => ({
    EMPTY_QUADRANTS: {
        bullishConfirmed: [],
        bullishExpected: [],
        bearishExpected: [],
        bearishConfirmed: [],
    },
    filterStrictAnticipation: (stocks: unknown[]) => stocks,
    resolveConflicts: (stocks: unknown[]) => ({
        resolved: stocks,
        mixed: [],
    }),
    groupStockIntoQuadrants: (
        acc: Record<string, unknown[]>,
        _stock: unknown
    ) => acc,
}));

vi.mock('@/shared/config/dashboard-tickers', () => ({
    SIGNAL_SECTORS: [
        { symbol: 'XLK', koreanName: '기술' },
        { symbol: 'XLF', koreanName: '금융' },
    ],
    DEFAULT_DASHBOARD_TIMEFRAME: '1Day',
}));

const DATA: SectorSignalsResult = {
    stocks: [
        {
            symbol: 'AAPL',
            koreanName: 'Apple',
            sectorSymbol: 'XLK',
            price: 150,
            changePercent: 1.5,
            signals: [],
        } as never,
    ],
    computedAt: '2025-01-01T00:00:00Z',
};

describe('useSectorSignalState', () => {
    afterEach(() => {
        mockReplace.mockClear();
    });

    it('returns initial sector and timeframe', () => {
        const { result } = renderHook(() =>
            useSectorSignalState({
                data: DATA,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );
        expect(result.current.activeSector).toBe('XLK');
        expect(result.current.activeTimeframe).toBe('1Day');
    });

    it('handleSectorChange updates sector and calls router.replace', () => {
        const { result } = renderHook(() =>
            useSectorSignalState({
                data: DATA,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        act(() => {
            result.current.handleSectorChange('XLF');
        });

        expect(result.current.activeSector).toBe('XLF');
        expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('handleTimeframeChange updates timeframe and calls router.replace', () => {
        const { result } = renderHook(() =>
            useSectorSignalState({
                data: DATA,
                initialSector: 'XLK',
                initialTimeframe: '1Day',
            })
        );

        act(() => {
            result.current.handleTimeframeChange('1Hour');
        });

        expect(result.current.activeTimeframe).toBe('1Hour');
        expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it('omits default sector and timeframe from query string', () => {
        const { result } = renderHook(() =>
            useSectorSignalState({
                data: DATA,
                initialSector: 'XLF',
                initialTimeframe: '1Hour',
            })
        );

        act(() => {
            result.current.handleSectorChange('XLK');
        });

        const url = mockReplace.mock.calls[0]?.[0] as string;
        expect(url).not.toContain('sector=');
    });
});
