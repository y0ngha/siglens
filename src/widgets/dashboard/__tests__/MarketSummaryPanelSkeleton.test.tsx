import { render, screen } from '@testing-library/react';
import { MarketSummaryPanelSkeleton } from '@/widgets/dashboard/MarketSummaryPanelSkeleton';

vi.mock('@/shared/config/dashboard-tickers', () => ({
    MARKET_INDICES: [
        { symbol: 'SPY' },
        { symbol: 'QQQ' },
        { symbol: 'DIA' },
        { symbol: 'IWM' },
    ],
    SECTOR_GROUPS: [
        { label: 'Tech', symbols: ['XLK', 'XLC', 'XLY'] },
        { label: 'Core', symbols: ['XLF', 'XLV', 'XLI', 'XLP'] },
    ],
}));

describe('MarketSummaryPanelSkeleton', () => {
    it('renders an aria-busy section', () => {
        render(<MarketSummaryPanelSkeleton />);
        const section = screen.getByLabelText('시장 현황 로딩 중');
        expect(section).toHaveAttribute('aria-busy', 'true');
    });

    it('renders skeleton placeholders for each market index', () => {
        const { container } = render(<MarketSummaryPanelSkeleton />);
        const indexSkeletons = container.querySelectorAll('.grid-cols-2 > div');
        expect(indexSkeletons).toHaveLength(4);
    });
});
