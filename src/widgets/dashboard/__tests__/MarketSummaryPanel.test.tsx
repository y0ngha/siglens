import { render, screen } from '@testing-library/react';
import { MarketSummaryPanel } from '@/widgets/dashboard/MarketSummaryPanel';

const mockUseMarketSummary = vi.fn();
vi.mock('@/widgets/dashboard/hooks/useMarketSummary', () => ({
    useMarketSummary: () => mockUseMarketSummary(),
}));

vi.mock('@/widgets/dashboard/hooks/useBriefing', () => ({
    useBriefing: vi.fn(),
}));

vi.mock('@/widgets/dashboard/MarketSummaryPanelSkeleton', () => ({
    MarketSummaryPanelSkeleton: () => (
        <div data-testid="skeleton">Loading...</div>
    ),
}));

vi.mock('@/widgets/dashboard/IndexCard', () => ({
    IndexCard: ({ data }: { data: { symbol: string } }) => (
        <div data-testid={`index-${data.symbol}`}>{data.symbol}</div>
    ),
}));

vi.mock('@/widgets/dashboard/BriefingCard', () => ({
    BriefingCard: () => <div data-testid="briefing">Briefing</div>,
    BriefingLoadingCard: () => <div data-testid="briefing-loading" />,
    BriefingErrorCard: () => <div data-testid="briefing-error" />,
}));

vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked" />,
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/shared/config/dashboard-tickers', () => ({
    SECTOR_GROUPS: [
        { label: 'Tech', symbols: ['XLK'] },
        { label: 'Finance', symbols: ['XLF', 'XLV', 'XLI'] },
    ],
}));

vi.mock('react-error-boundary', () => ({
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
}));

describe('MarketSummaryPanel', () => {
    afterEach(() => {
        mockUseMarketSummary.mockReset();
    });

    it('renders skeleton while pending', () => {
        mockUseMarketSummary.mockReturnValue({
            data: undefined,
            isPending: true,
            sectorMap: new Map(),
            indices: [],
        });
        render(<MarketSummaryPanel />);
        expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('renders null when data has ok: false', () => {
        mockUseMarketSummary.mockReturnValue({
            data: { ok: false },
            isPending: false,
            sectorMap: new Map(),
            indices: [],
        });
        const { container } = render(<MarketSummaryPanel />);
        expect(container.innerHTML).toBe('');
    });

    it('renders indices and section heading when data is loaded', () => {
        mockUseMarketSummary.mockReturnValue({
            data: {
                summary: { indices: [], sectors: [] },
                briefing: undefined,
            },
            isPending: false,
            sectorMap: new Map(),
            indices: [
                {
                    symbol: 'SPY',
                    fmpSymbol: '^GSPC',
                    koreanName: 'S&P 500',
                    displayName: 'S&P 500',
                    price: 5000,
                    changesPercentage: 1,
                },
            ],
        });
        render(<MarketSummaryPanel />);
        expect(screen.getByText('오늘의 미국 시장')).toBeInTheDocument();
        expect(screen.getByTestId('index-SPY')).toBeInTheDocument();
    });
});
