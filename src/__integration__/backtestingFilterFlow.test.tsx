import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import backtestData from '@/entities/backtest-case/data/data.json';
import { deriveBacktestStats } from '@/entities/backtest-case/lib/deriveBacktestStats';
import { validateBacktestRunData } from '@/entities/backtest-case/lib/validate';
import { BacktestComparison } from '@/widgets/backtesting/BacktestComparison';
import { BacktestHero } from '@/widgets/backtesting/BacktestHero';
import { BacktestTabs } from '@/widgets/backtesting/BacktestTabs';
import { BacktestTimingCheck } from '@/widgets/backtesting/BacktestTimingCheck';

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

/**
 * 데이터 검증 -> 통계 파생 -> 히어로/비교 표/진입 시점 점검까지 실제 `data.json`으로 잇는다.
 * 세 표면이 같은 기준선 값을 서로 다른 칸에 그리므로, 한 값이 표면마다 다르게 나오면 여기서 잡힌다.
 */
describe('Backtesting baseline flow', () => {
    const stats = deriveBacktestStats(validateBacktestRunData(backtestData));
    const { benchmarks } = backtestData;

    it('prints the same mark-to-market drawdown in the hero, the table and the timing check', () => {
        const mdd = `${benchmarks.strategyMarkToMarketMaxDrawdownPct.toFixed(1)}%`;
        render(
            <>
                <BacktestHero stats={stats} />
                <BacktestComparison stats={stats} />
                <BacktestTimingCheck stats={stats} />
            </>
        );
        const hero = screen
            .getByText('최대 낙폭 (매일 평가 기준)')
            .closest('div')?.parentElement;
        expect(hero).toHaveTextContent(mdd);
        const portfolioRow = screen.getAllByRole('row')[1];
        expect(portfolioRow).toHaveTextContent(mdd);
        expect(
            screen.getByText(new RegExp(`AI 전략\\(${mdd}\\)보다 작았던 경우`))
        ).toBeInTheDocument();
    });

    it('prints the same hold return in the hero card and the first table row', () => {
        const hold = `+${benchmarks.holdPortfolio.returnPct.toFixed(1)}%`;
        render(
            <>
                <BacktestHero stats={stats} />
                <BacktestComparison stats={stats} />
            </>
        );
        expect(
            screen.getByText(new RegExp(`계속 들고 있었다면 \\${hold}`))
        ).toBeInTheDocument();
        expect(screen.getAllByRole('row')[1]).toHaveTextContent(hold);
    });
});
