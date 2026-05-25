// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useBacktestFilter } from '@/features/backtest-filter/hooks/useBacktestFilter';
import type { BacktestCase } from '@y0ngha/siglens-core';

const mockSetTicker = vi.fn();
let mockRawTicker = '전체';

vi.mock('@/shared/hooks/useQueryParamState', () => ({
    useQueryParamState: (_key: string, _defaultValue: string) =>
        [mockRawTicker, mockSetTicker] as const,
}));

function createCase(ticker: string): BacktestCase {
    return { ticker } as BacktestCase;
}

describe('useBacktestFilter', () => {
    const cases = [
        createCase('AAPL'),
        createCase('AAPL'),
        createCase('MSFT'),
        createCase('GOOGL'),
    ];
    const tickers = ['AAPL', 'MSFT', 'GOOGL'];

    beforeEach(() => {
        vi.clearAllMocks();
        mockRawTicker = '전체';
    });

    it('returns tab items including the all-tab and each ticker', () => {
        const { result } = renderHook(() => useBacktestFilter(cases, tickers));

        expect(result.current.tabItems).toEqual([
            { value: '전체', label: '전체' },
            { value: 'AAPL', label: 'AAPL' },
            { value: 'MSFT', label: 'MSFT' },
            { value: 'GOOGL', label: 'GOOGL' },
        ]);
    });

    it('returns all cases when activeTab is the all-tab', () => {
        const { result } = renderHook(() => useBacktestFilter(cases, tickers));

        expect(result.current.activeTab).toBe('전체');
        expect(result.current.filtered).toEqual(cases);
    });

    it('filters cases by the active ticker', () => {
        mockRawTicker = 'AAPL';
        const { result } = renderHook(() => useBacktestFilter(cases, tickers));

        expect(result.current.activeTab).toBe('AAPL');
        expect(result.current.filtered).toEqual([
            createCase('AAPL'),
            createCase('AAPL'),
        ]);
    });

    it('falls back to the all-tab when rawTicker is not in the tickers list', () => {
        mockRawTicker = 'INVALID';
        const { result } = renderHook(() => useBacktestFilter(cases, tickers));

        expect(result.current.activeTab).toBe('전체');
        expect(result.current.filtered).toEqual(cases);
    });

    it('exposes setActiveTab that delegates to useQueryParamState setter', () => {
        const { result } = renderHook(() => useBacktestFilter(cases, tickers));

        act(() => {
            result.current.setActiveTab('MSFT');
        });

        expect(mockSetTicker).toHaveBeenCalledWith('MSFT');
    });

    it('returns empty filtered array when no cases match the active ticker', () => {
        mockRawTicker = 'GOOGL';
        const casesWithoutGoogl = [createCase('AAPL'), createCase('MSFT')];
        const { result } = renderHook(() =>
            useBacktestFilter(casesWithoutGoogl, tickers)
        );

        expect(result.current.filtered).toEqual([]);
    });

    it('returns an empty filtered array when cases is empty', () => {
        const { result } = renderHook(() => useBacktestFilter([], tickers));

        expect(result.current.filtered).toEqual([]);
    });
});
