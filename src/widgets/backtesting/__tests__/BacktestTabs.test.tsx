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
vi.mock('../BacktestCaseList', () => ({
    BacktestCaseList: ({
        cases,
        openAll,
    }: {
        cases: unknown[];
        openAll?: boolean;
    }) => (
        <div data-testid="case-list" data-open-all={String(openAll)}>
            {cases.length} cases
        </div>
    ),
}));

import { render, screen } from '@testing-library/react';

import { BacktestTabs } from '../BacktestTabs';

function filterState(overrides: Record<string, unknown> = {}) {
    return {
        tabItems: [
            { value: 'all', label: '전체' },
            { value: 'AAPL', label: 'AAPL' },
        ],
        activeTab: 'all',
        setActiveTab: vi.fn(),
        filtered: [],
        isFiltered: false,
        ...overrides,
    };
}

describe('BacktestTabs', () => {
    beforeEach(() => {
        mockUseBacktestFilter.mockReset();
        mockUseBacktestFilter.mockReturnValue(filterState());
    });

    it('전체 탭에서는 월을 기본 접힘 상태로 둔다 (openAll=false)', () => {
        render(<BacktestTabs cases={[]} tickers={['AAPL']} />);

        expect(screen.getByTestId('case-list')).toHaveAttribute(
            'data-open-all',
            'false'
        );
    });

    it('종목 필터가 걸리면 모든 월을 펼친다 (openAll=true)', () => {
        mockUseBacktestFilter.mockReturnValue(
            filterState({ activeTab: 'AAPL', isFiltered: true })
        );
        render(<BacktestTabs cases={[]} tickers={['AAPL']} />);

        expect(screen.getByTestId('case-list')).toHaveAttribute(
            'data-open-all',
            'true'
        );
    });

    it('renders the tab list', () => {
        render(<BacktestTabs cases={[]} tickers={['AAPL']} />);

        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /전체/ })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /AAPL/ })).toBeInTheDocument();
    });

    it('renders a tabpanel with BacktestCaseList', () => {
        render(<BacktestTabs cases={[]} tickers={['AAPL']} />);

        expect(screen.getByRole('tabpanel')).toBeInTheDocument();
        expect(screen.getByTestId('case-list')).toBeInTheDocument();
    });
});
