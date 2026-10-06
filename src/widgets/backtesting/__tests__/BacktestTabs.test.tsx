vi.mock('@/shared/ui/tabs/utils/tabIds', () => ({
    buildPanelId: (prefix: string, value: string) => `${prefix}-panel-${value}`,
    buildTabId: (prefix: string, value: string) => `${prefix}-tab-${value}`,
}));
vi.mock('@/shared/ui/tabs/TabsUnderline', () => ({
    TabsUnderline: ({
        tabs,
        activeTab,
        onChange,
    }: {
        tabs: { value: string; label: string }[];
        activeTab: string;
        onChange: (v: string) => void;
    }) => (
        <div role="tablist">
            {tabs.map(t => (
                <button
                    key={t.value}
                    role="tab"
                    aria-selected={activeTab === t.value}
                    onClick={() => onChange(t.value)}
                >
                    {t.label}
                </button>
            ))}
        </div>
    ),
}));
const { mockUseBacktestFilter } = vi.hoisted(() => ({
    mockUseBacktestFilter: vi.fn(),
}));
vi.mock('@/features/backtest-filter/hooks/useBacktestFilter', () => ({
    useBacktestFilter: mockUseBacktestFilter,
}));

import { render, screen } from '@testing-library/react';

import { BacktestTabs } from '../BacktestTabs';
import { UNFILTERED_TOKEN, visibilityAttrs } from '../lib/caseListVisibility';

function filterState(overrides: Record<string, unknown> = {}) {
    return {
        tabItems: [
            { value: 'all', label: '전체' },
            { value: 'AAPL', label: 'AAPL' },
            { value: 'NVDA', label: 'NVDA' },
        ],
        activeTab: 'all',
        setActiveTab: vi.fn(),
        isFiltered: false,
        ...overrides,
    };
}

/** 서버 렌더 `BacktestCaseList`와 같은 표기를 단 최소 목록. */
function ServerList() {
    return (
        <div>
            <details
                data-testid="month-jun"
                open
                {...visibilityAttrs([UNFILTERED_TOKEN, 'AAPL'])}
            >
                <summary>
                    <span
                        data-testid="count-all"
                        {...visibilityAttrs([UNFILTERED_TOKEN])}
                    >
                        1건
                    </span>
                    <span
                        data-testid="count-aapl"
                        hidden
                        {...visibilityAttrs(['AAPL'])}
                    >
                        1건
                    </span>
                </summary>
                <div
                    data-testid="card-aapl"
                    {...visibilityAttrs([UNFILTERED_TOKEN, 'AAPL'])}
                />
            </details>
            <details
                data-testid="month-may"
                {...visibilityAttrs([UNFILTERED_TOKEN, 'NVDA'])}
            >
                <summary>May</summary>
                <div
                    data-testid="card-nvda"
                    {...visibilityAttrs([UNFILTERED_TOKEN, 'NVDA'])}
                />
            </details>
        </div>
    );
}

function renderTabs() {
    return render(
        <BacktestTabs tickers={['AAPL', 'NVDA']}>
            <ServerList />
        </BacktestTabs>
    );
}

describe('BacktestTabs', () => {
    beforeEach(() => {
        mockUseBacktestFilter.mockReset();
        mockUseBacktestFilter.mockReturnValue(filterState());
    });

    it('renders the tab list', () => {
        renderTabs();

        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /전체/ })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /AAPL/ })).toBeInTheDocument();
    });

    it('서버가 렌더한 목록을 tabpanel 안에 그대로 둔다', () => {
        renderTabs();

        expect(screen.getByRole('tabpanel')).toContainElement(
            screen.getByTestId('card-aapl')
        );
    });

    it('전체 탭: 모든 카드·월이 보이고 월 펼침은 서버가 그린 그대로다', () => {
        renderTabs();

        expect(screen.getByTestId('card-aapl')).not.toHaveAttribute('hidden');
        expect(screen.getByTestId('card-nvda')).not.toHaveAttribute('hidden');
        expect(screen.getByTestId('count-all')).not.toHaveAttribute('hidden');
        expect(screen.getByTestId('count-aapl')).toHaveAttribute('hidden');
        expect(
            (screen.getByTestId('month-may') as HTMLDetailsElement).open
        ).toBe(false);
    });

    it('종목 탭: 그 종목 카드·월만 보이고 월은 펼치며 건수는 종목 기준으로 바뀐다', () => {
        mockUseBacktestFilter.mockReturnValue(
            filterState({ activeTab: 'NVDA', isFiltered: true })
        );
        renderTabs();

        expect(screen.getByTestId('card-aapl')).toHaveAttribute('hidden');
        expect(screen.getByTestId('month-jun')).toHaveAttribute('hidden');
        expect(screen.getByTestId('card-nvda')).not.toHaveAttribute('hidden');
        expect(
            (screen.getByTestId('month-may') as HTMLDetailsElement).open
        ).toBe(true);
    });

    it('종목 탭에서 전체 탭으로 돌아오면 숨김과 떠나기 전 펼침 상태를 되돌린다', () => {
        mockUseBacktestFilter.mockReturnValue(
            filterState({ activeTab: 'NVDA', isFiltered: true })
        );
        const { rerender } = renderTabs();

        mockUseBacktestFilter.mockReturnValue(filterState());
        rerender(
            <BacktestTabs tickers={['AAPL', 'NVDA']}>
                <ServerList />
            </BacktestTabs>
        );

        expect(screen.getByTestId('month-jun')).not.toHaveAttribute('hidden');
        expect(screen.getByTestId('card-aapl')).not.toHaveAttribute('hidden');
        expect(
            (screen.getByTestId('month-may') as HTMLDetailsElement).open
        ).toBe(false);
    });

    it('사용자가 직접 연 월은 종목 탭을 다녀와도 열린 채로 남는다', () => {
        const { rerender } = renderTabs();
        // 전체 탭에서 접혀 있던 5월을 사용자가 연다.
        (screen.getByTestId('month-may') as HTMLDetailsElement).open = true;

        mockUseBacktestFilter.mockReturnValue(
            filterState({ activeTab: 'AAPL', isFiltered: true })
        );
        rerender(
            <BacktestTabs tickers={['AAPL', 'NVDA']}>
                <ServerList />
            </BacktestTabs>
        );
        mockUseBacktestFilter.mockReturnValue(filterState());
        rerender(
            <BacktestTabs tickers={['AAPL', 'NVDA']}>
                <ServerList />
            </BacktestTabs>
        );

        expect(
            (screen.getByTestId('month-may') as HTMLDetailsElement).open
        ).toBe(true);
    });

    it('전체 탭에 머무는 동안에는 월 펼침을 건드리지 않는다', () => {
        const { rerender } = renderTabs();
        (screen.getByTestId('month-jun') as HTMLDetailsElement).open = false;

        rerender(
            <BacktestTabs tickers={['AAPL', 'NVDA']}>
                <ServerList />
            </BacktestTabs>
        );

        expect(
            (screen.getByTestId('month-jun') as HTMLDetailsElement).open
        ).toBe(false);
    });
});
