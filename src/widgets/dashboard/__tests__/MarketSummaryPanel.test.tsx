import { fireEvent, render, screen } from '@testing-library/react';
import { MarketSummaryPanel } from '@/widgets/dashboard/MarketSummaryPanel';

const mockUseMarketSummary = vi.fn();
vi.mock('@/widgets/dashboard/hooks/useMarketSummary', () => ({
    useMarketSummary: () => mockUseMarketSummary(),
}));

vi.mock('@/widgets/dashboard/MarketDataErrorNotice', () => ({
    MarketDataErrorNotice: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="data-error-notice">
            <button onClick={onClose}>close-notice</button>
        </div>
    ),
}));

const mockUseBriefing = vi.fn();
vi.mock('@/widgets/dashboard/hooks/useBriefing', () => ({
    useBriefing: () => mockUseBriefing(),
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
        mockUseBriefing.mockReset();
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

    it('완전 실패(ok:false) 시 데이터 로드 실패 안내만 표시한다', () => {
        mockUseMarketSummary.mockReturnValue({
            data: { ok: false },
            isPending: false,
            sectorMap: new Map(),
            indices: [],
            hasMissingQuotes: false,
        });
        render(<MarketSummaryPanel />);
        expect(screen.getByTestId('data-error-notice')).toBeInTheDocument();
        // 제목/카드 없이 안내만 — summary 자체가 없으므로
        expect(screen.queryByText('오늘의 미국 시장')).not.toBeInTheDocument();
    });

    it('완전 실패 안내를 닫으면 아무것도 렌더하지 않는다', () => {
        mockUseMarketSummary.mockReturnValue({
            data: { ok: false },
            isPending: false,
            sectorMap: new Map(),
            indices: [],
            hasMissingQuotes: false,
        });
        const { container } = render(<MarketSummaryPanel />);
        fireEvent.click(screen.getByText('close-notice'));
        expect(container.innerHTML).toBe('');
    });

    it('부분 실패(hasMissingQuotes) 시 안내와 지수 카드를 함께 표시한다', () => {
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
            hasMissingQuotes: true,
        });
        render(<MarketSummaryPanel />);
        expect(screen.getByTestId('data-error-notice')).toBeInTheDocument();
        expect(screen.getByText('오늘의 미국 시장')).toBeInTheDocument();
        expect(screen.getByTestId('index-SPY')).toBeInTheDocument();
    });

    it('부분 실패 안내를 닫으면 안내만 사라지고 카드는 유지된다', () => {
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
            hasMissingQuotes: true,
        });
        render(<MarketSummaryPanel />);
        fireEvent.click(screen.getByText('close-notice'));
        expect(
            screen.queryByTestId('data-error-notice')
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('index-SPY')).toBeInTheDocument();
    });

    it('정상 데이터(hasMissingQuotes=false)면 안내를 표시하지 않는다', () => {
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
            hasMissingQuotes: false,
        });
        render(<MarketSummaryPanel />);
        expect(
            screen.queryByTestId('data-error-notice')
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('index-SPY')).toBeInTheDocument();
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

    it('renders sector groups with ETF cards', () => {
        const sectorMap = new Map([
            [
                'XLK',
                {
                    symbol: 'XLK',
                    koreanName: 'IT',
                    displayName: 'Technology Select',
                    price: 200,
                    changesPercentage: 0.5,
                },
            ],
            [
                'XLF',
                {
                    symbol: 'XLF',
                    koreanName: '금융',
                    displayName: 'Financial Select',
                    price: 40,
                    changesPercentage: -0.3,
                },
            ],
            [
                'XLV',
                {
                    symbol: 'XLV',
                    koreanName: '헬스케어',
                    displayName: 'Health Care Select',
                    price: 140,
                    changesPercentage: 0.1,
                },
            ],
            [
                'XLI',
                {
                    symbol: 'XLI',
                    koreanName: '산업재',
                    displayName: 'Industrial Select',
                    price: 110,
                    changesPercentage: 0.2,
                },
            ],
        ]);

        mockUseMarketSummary.mockReturnValue({
            data: {
                summary: { indices: [], sectors: [] },
                briefing: undefined,
            },
            isPending: false,
            sectorMap,
            indices: [],
        });
        render(<MarketSummaryPanel />);
        expect(screen.getByText('Tech')).toBeInTheDocument();
        expect(screen.getByText('Finance')).toBeInTheDocument();
        expect(screen.getByTestId('index-XLK')).toBeInTheDocument();
        expect(screen.getByTestId('index-XLF')).toBeInTheDocument();
    });

    it('briefing이 submitted면 처리 중에는 로딩 카드를 렌더한다', () => {
        mockUseBriefing.mockReturnValue({ status: 'processing' });
        mockUseMarketSummary.mockReturnValue({
            data: {
                summary: { indices: [], sectors: [] },
                briefing: { status: 'submitted', jobId: 'job-1' },
            },
            isPending: false,
            sectorMap: new Map(),
            indices: [],
            hasMissingQuotes: false,
        });
        render(<MarketSummaryPanel />);
        expect(screen.getByTestId('briefing-loading')).toBeInTheDocument();
    });

    it('briefing이 submitted면 완료 시 브리핑 카드를 렌더한다', () => {
        mockUseBriefing.mockReturnValue({
            status: 'done',
            briefing: 'AI briefing text',
            generatedAt: '2025-01-01T00:00:00Z',
        });
        mockUseMarketSummary.mockReturnValue({
            data: {
                summary: { indices: [], sectors: [] },
                briefing: { status: 'submitted', jobId: 'job-1' },
            },
            isPending: false,
            sectorMap: new Map(),
            indices: [],
            hasMissingQuotes: false,
        });
        render(<MarketSummaryPanel />);
        expect(screen.getByTestId('briefing')).toBeInTheDocument();
    });

    it('renders cached briefing when briefing status is cached', () => {
        mockUseMarketSummary.mockReturnValue({
            data: {
                summary: { indices: [], sectors: [] },
                briefing: {
                    status: 'cached',
                    briefing: 'AI briefing text',
                    generatedAt: '2025-01-01T00:00:00Z',
                },
            },
            isPending: false,
            sectorMap: new Map(),
            indices: [],
        });
        render(<MarketSummaryPanel />);
        expect(screen.getByTestId('briefing')).toBeInTheDocument();
    });

    it('renders nothing for BriefingRegion when briefing is null (converted to undefined by ??)', () => {
        // data.briefing=null → data?.briefing ?? undefined → input=undefined → renders null
        mockUseMarketSummary.mockReturnValue({
            data: {
                summary: { indices: [], sectors: [] },
                briefing: null,
            },
            isPending: false,
            sectorMap: new Map(),
            indices: [],
        });
        render(<MarketSummaryPanel />);
        expect(screen.queryByTestId('bot-blocked')).not.toBeInTheDocument();
        expect(screen.queryByTestId('briefing')).not.toBeInTheDocument();
    });

    it('does not show briefing region when briefing is undefined', () => {
        mockUseMarketSummary.mockReturnValue({
            data: {
                summary: { indices: [], sectors: [] },
                briefing: undefined,
            },
            isPending: false,
            sectorMap: new Map(),
            indices: [],
        });
        render(<MarketSummaryPanel />);
        expect(screen.queryByTestId('briefing')).not.toBeInTheDocument();
        expect(screen.queryByTestId('bot-blocked')).not.toBeInTheDocument();
    });

    it('grid-cols-3 when sector group has 3 items', () => {
        const sectorMap = new Map([
            [
                'XLF',
                {
                    symbol: 'XLF',
                    koreanName: '금융',
                    displayName: 'Financial',
                    price: 40,
                    changesPercentage: 0,
                },
            ],
            [
                'XLV',
                {
                    symbol: 'XLV',
                    koreanName: '헬스케어',
                    displayName: 'Health',
                    price: 140,
                    changesPercentage: 0,
                },
            ],
            [
                'XLI',
                {
                    symbol: 'XLI',
                    koreanName: '산업재',
                    displayName: 'Industrial',
                    price: 110,
                    changesPercentage: 0,
                },
            ],
        ]);

        mockUseMarketSummary.mockReturnValue({
            data: {
                summary: { indices: [], sectors: [] },
                briefing: undefined,
            },
            isPending: false,
            sectorMap,
            indices: [],
        });
        const { container } = render(<MarketSummaryPanel />);
        // Finance group has 3 symbols, so it should use grid-cols-3
        const grids = container.querySelectorAll('.grid-cols-3');
        expect(grids.length).toBeGreaterThan(0);
    });
});
