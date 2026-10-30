vi.mock('@/shared/ui/tabs/utils/tabIds', () => ({
    buildPanelId: (prefix: string, value: string) => `${prefix}-panel-${value}`,
    buildTabId: (prefix: string, value: string) => `${prefix}-tab-${value}`,
}));
vi.mock('@/shared/ui/tabs/TabsUnderline', () => ({
    TabsUnderline: ({
        tabs,
        activeTab,
        onChange,
        panelMounting,
    }: {
        tabs: { value: string; label: string }[];
        activeTab: string;
        onChange: (v: string) => void;
        panelMounting?: string;
    }) => (
        <div role="tablist" data-panel-mounting={panelMounting}>
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

import { render, screen, waitFor } from '@testing-library/react';

import { BacktestTabs } from '../../BacktestTabs';
import {
    cardAttrs,
    EMPTY_ATTR,
    UNFILTERED_TOKEN,
    visibilityAttrs,
} from '../../utils/caseListVisibility';

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
            <p data-testid="empty" hidden {...{ [EMPTY_ATTR]: '' }}>
                비어 있음
            </p>
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
                    {...cardAttrs([UNFILTERED_TOKEN, 'AAPL'])}
                />
            </details>
            <details
                data-testid="month-may"
                {...visibilityAttrs([UNFILTERED_TOKEN, 'NVDA'])}
            >
                <summary>May</summary>
                <div
                    data-testid="card-nvda"
                    {...cardAttrs([UNFILTERED_TOKEN, 'NVDA'])}
                />
            </details>
        </div>
    );
}

/** 서버 컴포넌트 새로고침으로 바뀐 뒤의 목록: 서버 HTML 그대로(전부 보임, 접힘) 들어온다. */
function RefreshedList() {
    return (
        <div>
            <details
                data-testid="month-apr"
                {...visibilityAttrs([UNFILTERED_TOKEN, 'AAPL'])}
            >
                <summary>Apr</summary>
                <div
                    data-testid="card-aapl-apr"
                    {...cardAttrs([UNFILTERED_TOKEN, 'AAPL'])}
                />
            </details>
            <details
                data-testid="month-mar"
                {...visibilityAttrs([UNFILTERED_TOKEN, 'NVDA'])}
            >
                <summary>Mar</summary>
                <div
                    data-testid="card-nvda-mar"
                    {...cardAttrs([UNFILTERED_TOKEN, 'NVDA'])}
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

    describe('서버 목록이 새로고침으로 바뀔 때', () => {
        it('종목 탭이 켜져 있으면 새 요소도 다시 거르고 새 월은 펼친다', async () => {
            mockUseBacktestFilter.mockReturnValue(
                filterState({ activeTab: 'AAPL', isFiltered: true })
            );
            const { rerender } = renderTabs();

            rerender(
                <BacktestTabs tickers={['AAPL', 'NVDA']}>
                    <RefreshedList />
                </BacktestTabs>
            );

            await waitFor(() =>
                expect(screen.getByTestId('card-nvda-mar')).toHaveAttribute(
                    'hidden'
                )
            );
            expect(screen.getByTestId('month-mar')).toHaveAttribute('hidden');
            expect(screen.getByTestId('card-aapl-apr')).not.toHaveAttribute(
                'hidden'
            );
            expect(
                (screen.getByTestId('month-apr') as HTMLDetailsElement).open
            ).toBe(true);
        });

        it('새로 들어온 월의 서버 펼침 상태를 기억해 전체 탭에서 되돌린다', async () => {
            mockUseBacktestFilter.mockReturnValue(
                filterState({ activeTab: 'AAPL', isFiltered: true })
            );
            const { rerender } = renderTabs();
            rerender(
                <BacktestTabs tickers={['AAPL', 'NVDA']}>
                    <RefreshedList />
                </BacktestTabs>
            );
            await waitFor(() =>
                expect(
                    (screen.getByTestId('month-apr') as HTMLDetailsElement).open
                ).toBe(true)
            );

            mockUseBacktestFilter.mockReturnValue(filterState());
            rerender(
                <BacktestTabs tickers={['AAPL', 'NVDA']}>
                    <RefreshedList />
                </BacktestTabs>
            );

            expect(
                (screen.getByTestId('month-apr') as HTMLDetailsElement).open
            ).toBe(false);
            expect(screen.getByTestId('month-mar')).not.toHaveAttribute(
                'hidden'
            );
        });
    });

    describe('보이는 카드가 없을 때의 안내', () => {
        it('고른 종목에 카드가 없으면 안내를 드러낸다', () => {
            mockUseBacktestFilter.mockReturnValue(
                filterState({ activeTab: 'ZZZ', isFiltered: true })
            );
            renderTabs();

            expect(screen.getByTestId('empty')).not.toHaveAttribute('hidden');
        });

        it('카드가 하나라도 보이면 안내는 숨는다', () => {
            mockUseBacktestFilter.mockReturnValue(
                filterState({ activeTab: 'AAPL', isFiltered: true })
            );
            renderTabs();

            expect(screen.getByTestId('empty')).toHaveAttribute('hidden');
        });

        it('전체 탭에서는 안내가 숨는다', () => {
            renderTabs();

            expect(screen.getByTestId('empty')).toHaveAttribute('hidden');
        });
    });

    describe('panelMounting', () => {
        it("활성 패널만 마운트하므로 TabsUnderline에 panelMounting='active'를 넘긴다", () => {
            mockUseBacktestFilter.mockReturnValue(filterState());

            render(
                <BacktestTabs tickers={['AAPL', 'NVDA']}>
                    <ServerList />
                </BacktestTabs>
            );

            expect(screen.getByRole('tablist')).toHaveAttribute(
                'data-panel-mounting',
                'active'
            );
        });
    });
});
