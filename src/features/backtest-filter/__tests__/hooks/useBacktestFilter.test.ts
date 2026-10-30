// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { koMessage } from '@/shared/test-utils/koMessage';
import { useBacktestFilter } from '@/features/backtest-filter/hooks/useBacktestFilter';
import { BACKTEST_ALL_TAB as ALL_TAB } from '@/features/backtest-filter/lib/tickerQuery';

const ALL_LABEL = koMessage('shared.ui.misc.filterAll');
const withIntl = { wrapper: IntlTestProvider } as const;

describe('useBacktestFilter', () => {
    const tickers = ['AAPL', 'MSFT', 'GOOGL'];

    beforeEach(() => {
        vi.clearAllMocks();
        window.history.pushState({}, '', '/backtesting');
    });

    it('returns tab items including the all-tab and each ticker', () => {
        const { result } = renderHook(
            () => useBacktestFilter(tickers),
            withIntl
        );

        expect(result.current.tabItems).toEqual([
            { value: ALL_TAB, label: ALL_LABEL },
            { value: 'AAPL', label: 'AAPL' },
            { value: 'MSFT', label: 'MSFT' },
            { value: 'GOOGL', label: 'GOOGL' },
        ]);
    });

    it('starts on the all-tab and is not filtered', () => {
        const { result } = renderHook(
            () => useBacktestFilter(tickers),
            withIntl
        );

        expect(result.current.activeTab).toBe(ALL_TAB);
        expect(result.current.isFiltered).toBe(false);
    });

    it('isFiltered는 종목 탭이 골라지면 true다 (월 접힘을 풀어 주는 신호)', () => {
        window.history.pushState({}, '', '/backtesting?ticker=AAPL');

        const { result } = renderHook(
            () => useBacktestFilter(tickers),
            withIntl
        );

        expect(result.current.isFiltered).toBe(true);
    });

    it('filters cases by the ticker present in the URL on mount', () => {
        window.history.pushState({}, '', '/backtesting?ticker=AAPL');

        const { result } = renderHook(
            () => useBacktestFilter(tickers),
            withIntl
        );

        expect(result.current.activeTab).toBe('AAPL');
    });

    it('falls back to the all-tab when the URL ticker is not in the tickers list', () => {
        window.history.pushState({}, '', '/backtesting?ticker=INVALID');

        const { result } = renderHook(
            () => useBacktestFilter(tickers),
            withIntl
        );

        expect(result.current.activeTab).toBe(ALL_TAB);
    });

    it('updates activeTab and replaces the URL without router navigation', () => {
        const replaceSpy = vi.spyOn(window.history, 'replaceState');
        const { result } = renderHook(
            () => useBacktestFilter(tickers),
            withIntl
        );

        act(() => {
            result.current.setActiveTab('MSFT');
        });

        expect(result.current.activeTab).toBe('MSFT');
        expect(replaceSpy).toHaveBeenCalledWith(
            null,
            '',
            '/backtesting?ticker=MSFT'
        );
        expect(window.location.search).toBe('?ticker=MSFT');
        replaceSpy.mockRestore();
    });

    it('removes the ticker param when setActiveTab is called with the all-tab', () => {
        window.history.pushState({}, '', '/backtesting?ticker=MSFT');
        const { result } = renderHook(
            () => useBacktestFilter(tickers),
            withIntl
        );

        act(() => {
            result.current.setActiveTab(ALL_TAB);
        });

        // 방금 고른 값(pick)이 URL에서 읽은 탭보다 우선해야 한다 — 순서가 뒤집히면
        // URL에 남은 옛 ?ticker=가 방금 고른 "전체"를 도로 덮어쓴다.
        expect(result.current.activeTab).toBe(ALL_TAB);
        expect(window.location.pathname + window.location.search).toBe(
            '/backtesting'
        );
    });

    it('keeps the locale prefix of the current path when replacing the URL', () => {
        window.history.pushState({}, '', '/en/backtesting');
        const { result } = renderHook(
            () => useBacktestFilter(tickers),
            withIntl
        );

        act(() => {
            result.current.setActiveTab('AAPL');
        });

        expect(window.location.pathname + window.location.search).toBe(
            '/en/backtesting?ticker=AAPL'
        );
    });

    it('뒤로/앞으로 가기(popstate)가 오면 사용자가 고른 탭 대신 URL의 ?ticker=를 따른다', () => {
        // 고른 탭이 영원히 URL보다 앞서면, 같은 경로에서 ?ticker=만 다른 히스토리
        // 항목으로 돌아가도 화면이 마지막 선택에 머문다.
        window.history.pushState({}, '', '/backtesting?ticker=AAPL');
        const { result } = renderHook(
            () => useBacktestFilter(tickers),
            withIntl
        );

        act(() => {
            result.current.setActiveTab('MSFT');
        });
        expect(result.current.activeTab).toBe('MSFT');

        act(() => {
            window.history.pushState({}, '', '/backtesting?ticker=GOOGL');
            window.dispatchEvent(new PopStateEvent('popstate'));
        });

        expect(result.current.activeTab).toBe('GOOGL');
        expect(result.current.isFiltered).toBe(true);
    });

    it('preserves other query params and the hash when replacing the URL', () => {
        window.history.pushState({}, '', '/backtesting?utm_source=x#cases');
        const { result } = renderHook(
            () => useBacktestFilter(tickers),
            withIntl
        );

        act(() => {
            result.current.setActiveTab('AAPL');
        });

        expect(
            window.location.pathname +
                window.location.search +
                window.location.hash
        ).toBe('/backtesting?utm_source=x&ticker=AAPL#cases');
    });

    it('falls back to the all-tab when setActiveTab gets a value outside the tickers list', () => {
        window.history.pushState({}, '', '/backtesting?ticker=AAPL');
        const { result } = renderHook(
            () => useBacktestFilter(tickers),
            withIntl
        );

        act(() => {
            result.current.setActiveTab('INVALID');
        });

        expect(result.current.activeTab).toBe(ALL_TAB);
        expect(window.location.search).toBe('');
    });

    it('하이드레이션 렌더는 ?ticker=가 있어도 전체 탭(서버 스냅샷)을 먼저 쓰고, 그 다음 URL 값으로 전환한다', () => {
        // 하이드레이션 렌더가 `useUrlSearchParam`의 서버 스냅샷(`null`)을 쓰지 않으면
        // 정적 HTML(전체 탭 기준)과 클라이언트 첫 렌더(MSFT 기준)가 어긋난다.
        window.history.pushState({}, '', '/backtesting?ticker=MSFT');
        const seen: string[] = [];

        renderHook(
            () => {
                const r = useBacktestFilter(tickers);
                seen.push(r.activeTab);
                return r;
            },
            { ...withIntl, hydrate: true }
        );

        expect(seen[0]).toBe(ALL_TAB);
        expect(seen[seen.length - 1]).toBe('MSFT');
    });
});
