import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BacktestTabs } from '@/widgets/backtesting/BacktestTabs';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/backtesting',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

let mockActiveTab = 'all';
const mockSetActiveTab = vi.fn((tab: string) => {
    mockActiveTab = tab;
});

vi.mock('@/features/backtest-filter/hooks/useBacktestFilter', () => ({
    useBacktestFilter: () => ({
        tabItems: [
            { value: 'all', label: '전체' },
            { value: 'AAPL', label: 'AAPL' },
            { value: 'TSLA', label: 'TSLA' },
        ],
        activeTab: mockActiveTab,
        setActiveTab: mockSetActiveTab,
        isFiltered: mockActiveTab !== 'all',
    }),
}));

function CaseList() {
    return <div data-testid="case-list">Cases</div>;
}

vi.mock('@/shared/ui/tabs/TabsUnderline', async () => {
    const { createTabsUnderlineMock } =
        await import('./helpers/TabsUnderlineMock');
    return createTabsUnderlineMock();
});

describe('Backtesting Filter Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockActiveTab = 'all';
    });

    it('renders ticker filter tabs', () => {
        render(
            <BacktestTabs tickers={['AAPL', 'TSLA']}>
                <CaseList />
            </BacktestTabs>
        );
        expect(screen.getByText('전체')).toBeInTheDocument();
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('TSLA')).toBeInTheDocument();
    });

    it('calls setActiveTab when a filter tab is clicked', async () => {
        render(
            <BacktestTabs tickers={['AAPL', 'TSLA']}>
                <CaseList />
            </BacktestTabs>
        );
        const user = userEvent.setup();
        await user.click(screen.getByText('AAPL'));
        expect(mockSetActiveTab).toHaveBeenCalledWith('AAPL');
    });

    it('marks "all" tab as active by default', () => {
        render(
            <BacktestTabs tickers={['AAPL']}>
                <CaseList />
            </BacktestTabs>
        );
        const allTab = screen.getByRole('tab', { name: '전체' });
        expect(allTab).toHaveAttribute('aria-selected', 'true');
    });

    it('renders tabpanel for filtered results', () => {
        render(
            <BacktestTabs tickers={['AAPL']}>
                <CaseList />
            </BacktestTabs>
        );
        expect(screen.getByTestId('case-list')).toBeInTheDocument();
    });
});
