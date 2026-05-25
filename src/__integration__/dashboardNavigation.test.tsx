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

vi.mock('@/shared/config/dashboard-tickers', () => ({
    SIGNAL_SECTORS: [
        { symbol: 'XLK', koreanName: '기술' },
        { symbol: 'XLV', koreanName: '헬스케어' },
        { symbol: 'XLF', koreanName: '금융' },
    ],
}));

vi.mock('@/shared/ui/tabs', () => ({
    TabsUnderline: ({
        tabs,
        activeTab,
        onChange,
        ariaLabel,
    }: {
        tabs: Array<{ value: string; label: string }>;
        activeTab: string;
        onChange: (v: string) => void;
        ariaLabel: string;
        size?: string;
        idPrefix?: string;
    }) => (
        <div role="tablist" aria-label={ariaLabel}>
            {tabs.map(t => (
                <button
                    key={t.value}
                    role="tab"
                    aria-selected={t.value === activeTab}
                    onClick={() => onChange(t.value)}
                >
                    {t.label}
                </button>
            ))}
        </div>
    ),
}));

describe('Dashboard Navigation', () => {
    describe('SectorTabs', () => {
        it('renders sector tabs with Korean labels', () => {
            render(<SectorTabs activeSector="XLK" onChange={vi.fn()} />);
            expect(screen.getByText('기술')).toBeInTheDocument();
            expect(screen.getByText('헬스케어')).toBeInTheDocument();
            expect(screen.getByText('금융')).toBeInTheDocument();
        });

        it('marks active sector tab', () => {
            render(<SectorTabs activeSector="XLK" onChange={vi.fn()} />);
            const activeTab = screen.getByRole('tab', { name: '기술' });
            expect(activeTab).toHaveAttribute('aria-selected', 'true');
        });

        it('calls onChange when sector tab is clicked', async () => {
            const onChange = vi.fn();
            render(<SectorTabs activeSector="XLK" onChange={onChange} />);
            const user = userEvent.setup();
            await user.click(screen.getByText('헬스케어'));
            expect(onChange).toHaveBeenCalledWith('XLV');
        });

        it('has tablist with accessible label', () => {
            render(<SectorTabs activeSector="XLK" onChange={vi.fn()} />);
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
            render(<SignalStockCard data={MOCK_STOCK} />);
            expect(screen.getByText('AAPL')).toBeInTheDocument();
            expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
        });

        it('renders link to symbol page', () => {
            render(<SignalStockCard data={MOCK_STOCK} />);
            const link = screen.getByRole('link');
            expect(link).toHaveAttribute('href', '/AAPL');
        });

        it('renders price change with correct formatting', () => {
            render(<SignalStockCard data={MOCK_STOCK} />);
            expect(screen.getByText(/2\.50%/)).toBeInTheDocument();
        });
    });
});
