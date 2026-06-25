// @vitest-environment jsdom
vi.mock('@/entities/bars/hooks/useBars', () => ({
    useBars: vi.fn(() => ({
        bars: [{ time: 1, open: 100, high: 110, low: 90, close: 105 }],
        indicators: { buySellVolume: [] },
    })),
}));
vi.mock('@/widgets/fear-greed/hooks/useFearGreed', () => ({
    useFearGreed: vi.fn(() => ({
        snapshot: { score: 55, label: 'NEUTRAL' },
        history: [],
    })),
}));
vi.mock('@/shared/config/market', () => ({
    DEFAULT_TIMEFRAME: '1Day',
}));

import { renderHook } from '@testing-library/react';
import { useBars } from '@/entities/bars/hooks/useBars';
import { useFearGreed } from '@/widgets/fear-greed/hooks/useFearGreed';

import { useFearGreedFromSymbol } from '../../hooks/useFearGreedFromSymbol';

describe('useFearGreedFromSymbol', () => {
    it('calls useBars with the symbol and DEFAULT_TIMEFRAME', () => {
        renderHook(() =>
            useFearGreedFromSymbol({ symbol: 'AAPL', fmpSymbol: 'aapl-fmp' })
        );

        expect(useBars).toHaveBeenCalledWith({
            symbol: 'AAPL',
            timeframe: '1Day',
            fmpSymbol: 'aapl-fmp',
        });
    });

    it('passes bars and buySellVolume to useFearGreed', () => {
        renderHook(() => useFearGreedFromSymbol({ symbol: 'AAPL' }));

        expect(useFearGreed).toHaveBeenCalledWith({
            bars: [{ time: 1, open: 100, high: 110, low: 90, close: 105 }],
            buySellVolume: [],
        });
    });

    it('returns the useFearGreed result', () => {
        const { result } = renderHook(() =>
            useFearGreedFromSymbol({ symbol: 'AAPL' })
        );

        expect(result.current).toEqual({
            snapshot: { score: 55, label: 'NEUTRAL' },
            history: [],
        });
    });
});
