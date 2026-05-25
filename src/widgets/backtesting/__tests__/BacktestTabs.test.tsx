vi.mock('@/shared/ui/tabs', () => ({
    buildPanelId: (prefix: string, value: string) => `${prefix}-panel-${value}`,
    buildTabId: (prefix: string, value: string) => `${prefix}-tab-${value}`,
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
vi.mock('@/features/backtest-filter', () => ({
    useBacktestFilter: vi.fn(() => ({
        tabItems: [
            { value: 'all', label: '전체' },
            { value: 'AAPL', label: 'AAPL' },
        ],
        activeTab: 'all',
        setActiveTab: vi.fn(),
        filtered: [],
    })),
}));
vi.mock('../BacktestCaseList', () => ({
    BacktestCaseList: ({ cases }: { cases: unknown[] }) => (
        <div data-testid="case-list">{cases.length} cases</div>
    ),
}));

import { render, screen } from '@testing-library/react';

import { BacktestTabs } from '../BacktestTabs';

describe('BacktestTabs', () => {
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
