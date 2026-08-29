// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { koMessage } from '@/shared/test-utils/koMessage';

/**
 * "전체" 탭의 **값**은 `'all'`로 고정이고 라벨만 번역된다 — 값이 로케일마다
 * 바뀌면 `?ticker=` 왕복이 깨지기 때문이다.
 */
const ALL_TAB = 'all';
const ALL_LABEL = koMessage('shared.ui.misc.filterAll');
const withIntl = { wrapper: IntlTestProvider } as const;
import { useBacktestFilter } from '@/features/backtest-filter/hooks/useBacktestFilter';
import type { BacktestCase } from '@y0ngha/siglens-core';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace }),
    usePathname: () => '/backtesting',
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
        window.history.pushState({}, '', '/backtesting');
    });

    it('returns tab items including the all-tab and each ticker', () => {
        const { result } = renderHook(
            () => useBacktestFilter(cases, tickers),
            withIntl
        );

        expect(result.current.tabItems).toEqual([
            { value: ALL_TAB, label: ALL_LABEL },
            { value: 'AAPL', label: 'AAPL' },
            { value: 'MSFT', label: 'MSFT' },
            { value: 'GOOGL', label: 'GOOGL' },
        ]);
    });

    it('returns all cases when activeTab is the all-tab', () => {
        const { result } = renderHook(
            () => useBacktestFilter(cases, tickers),
            withIntl
        );

        expect(result.current.activeTab).toBe(ALL_TAB);
        expect(result.current.filtered).toEqual(cases);
    });

    it('filters cases by the ticker present in the URL on mount', () => {
        window.history.pushState({}, '', '/backtesting?ticker=AAPL');

        const { result } = renderHook(
            () => useBacktestFilter(cases, tickers),
            withIntl
        );

        expect(result.current.activeTab).toBe('AAPL');
        expect(result.current.filtered).toEqual([
            createCase('AAPL'),
            createCase('AAPL'),
        ]);
    });

    it('falls back to the all-tab when the URL ticker is not in the tickers list', () => {
        window.history.pushState({}, '', '/backtesting?ticker=INVALID');

        const { result } = renderHook(
            () => useBacktestFilter(cases, tickers),
            withIntl
        );

        expect(result.current.activeTab).toBe(ALL_TAB);
        expect(result.current.filtered).toEqual(cases);
    });

    it('updates activeTab and replaces the URL when setActiveTab is called', () => {
        const { result } = renderHook(
            () => useBacktestFilter(cases, tickers),
            withIntl
        );

        act(() => {
            result.current.setActiveTab('MSFT');
        });

        expect(result.current.activeTab).toBe('MSFT');
        expect(mockReplace).toHaveBeenCalledWith('/backtesting?ticker=MSFT', {
            scroll: false,
        });
    });

    it('removes the ticker param when setActiveTab is called with the all-tab', () => {
        window.history.pushState({}, '', '/backtesting?ticker=MSFT');
        const { result } = renderHook(
            () => useBacktestFilter(cases, tickers),
            withIntl
        );

        act(() => {
            result.current.setActiveTab(ALL_TAB);
        });

        expect(mockReplace).toHaveBeenCalledWith('/backtesting', {
            scroll: false,
        });
    });

    it('returns empty filtered array when no cases match the URL ticker', () => {
        window.history.pushState({}, '', '/backtesting?ticker=GOOGL');
        const casesWithoutGoogl = [createCase('AAPL'), createCase('MSFT')];
        const { result } = renderHook(
            () => useBacktestFilter(casesWithoutGoogl, tickers),
            withIntl
        );

        expect(result.current.filtered).toEqual([]);
    });

    it('returns an empty filtered array when cases is empty', () => {
        const { result } = renderHook(
            () => useBacktestFilter([], tickers),
            withIntl
        );

        expect(result.current.filtered).toEqual([]);
    });
});
