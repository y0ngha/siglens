import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SectorTabs } from '@/widgets/dashboard/SectorTabs';
import { SignalStockCard } from '@/widgets/dashboard/SignalStockCard';
import type { StockWithConflict } from '@y0ngha/siglens-core';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/market',
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

/**
 * `SectorTabs`가 섹터 목록을 **prop으로** 받으므로 모듈 목이 필요 없다.
 * (예전에는 모듈 최상단 `SIGNAL_SECTORS`를 읽어서 목이 필수였다.)
 */
const TEST_SECTORS = [
    { symbol: 'XLK', sectorName: 'Technology', koreanName: '기술' },
    { symbol: 'XLV', sectorName: 'Healthcare', koreanName: '헬스케어' },
    { symbol: 'XLF', sectorName: 'Financials', koreanName: '금융' },
] as const;

vi.mock('@/shared/ui/tabs', async () => {
    const { createTabsUnderlineMock } =
        await import('./helpers/TabsUnderlineMock');
    return createTabsUnderlineMock();
});

describe('Dashboard Navigation', () => {
    describe('SectorTabs', () => {
        it('renders sector tabs with Korean labels', () => {
            render(
                <SectorTabs
                    sectors={TEST_SECTORS}
                    activeSector="XLK"
                    onChange={vi.fn()}
                />
            );
            expect(screen.getByText('기술')).toBeInTheDocument();
            expect(screen.getByText('헬스케어')).toBeInTheDocument();
            expect(screen.getByText('금융')).toBeInTheDocument();
        });

        it('marks active sector tab', () => {
            render(
                <SectorTabs
                    sectors={TEST_SECTORS}
                    activeSector="XLK"
                    onChange={vi.fn()}
                />
            );
            const activeTab = screen.getByRole('tab', { name: '기술' });
            expect(activeTab).toHaveAttribute('aria-selected', 'true');
        });

        it('calls onChange when sector tab is clicked', async () => {
            const onChange = vi.fn();
            render(
                <SectorTabs
                    sectors={TEST_SECTORS}
                    activeSector="XLK"
                    onChange={onChange}
                />
            );
            const user = userEvent.setup();
            await user.click(screen.getByText('헬스케어'));
            expect(onChange).toHaveBeenCalledWith('XLV');
        });

        it('has tablist with accessible label', () => {
            render(
                <SectorTabs
                    sectors={TEST_SECTORS}
                    activeSector="XLK"
                    onChange={vi.fn()}
                />
            );
            expect(
                screen.getByRole('tablist', { name: '섹터 선택' })
            ).toBeInTheDocument();
        });
    });

    describe('SignalStockCard', () => {
        const MOCK_STOCK = {
            symbol: 'AAPL',
            koreanName: 'Apple Inc.',
            price: 150.25,
            changePercent: 2.5,
            sectorSymbol: 'XLK',
            trend: 'bullish',
            signals: [{ type: 'golden_cross' }],
            conflict: null,
        } as unknown as StockWithConflict;

        it('renders stock card with symbol and name', () => {
            render(
                <SignalStockCard
                    tickerIsReadable
                    currencySymbol="$"
                    data={MOCK_STOCK}
                />
            );
            expect(screen.getByText('AAPL')).toBeInTheDocument();
            expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
        });

        it('renders link to symbol page', () => {
            render(
                <SignalStockCard
                    tickerIsReadable
                    currencySymbol="$"
                    data={MOCK_STOCK}
                />
            );
            const link = screen.getByRole('link');
            expect(link).toHaveAttribute('href', '/AAPL');
        });

        it('renders price change with correct formatting', () => {
            render(
                <SignalStockCard
                    tickerIsReadable
                    currencySymbol="$"
                    data={MOCK_STOCK}
                />
            );
            expect(screen.getByText(/2\.50%/)).toBeInTheDocument();
        });
    });
});
