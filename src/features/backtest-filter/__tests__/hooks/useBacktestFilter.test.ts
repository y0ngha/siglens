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

        // explicitTab(사용자가 방금 고른 값)이 urlTab보다 우선해야 한다 — 순서가
        // 뒤집히면 URL에 남은 옛 ?ticker=가 방금 고른 "전체"를 도로 덮어쓴다.
        expect(result.current.activeTab).toBe(ALL_TAB);
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

    it('하이드레이션 렌더는 ?ticker=가 있어도 전체 탭(서버 스냅샷)을 먼저 쓰고, 그 다음 URL 값으로 전환한다', () => {
        // getServerUrlTicker가 하이드레이션 렌더에 쓰이지 않으면 정적 HTML(전체
        // 탭 기준)과 클라이언트 첫 렌더(MSFT 기준)가 어긋난다.
        window.history.pushState({}, '', '/backtesting?ticker=MSFT');
        const seen: string[] = [];

        renderHook(
            () => {
                const r = useBacktestFilter(cases, tickers);
                seen.push(r.activeTab);
                return r;
            },
            { ...withIntl, hydrate: true }
        );

        expect(seen[0]).toBe(ALL_TAB);
        expect(seen[seen.length - 1]).toBe('MSFT');
    });
});
