import { render, screen } from '@testing-library/react';
import { IndexCard } from '@/widgets/dashboard/IndexCard';
import type { MarketIndexData, MarketSectorData } from '@y0ngha/siglens-core';

vi.mock('next/link', () => ({
    default: ({
        children,
        href,
        title,
    }: {
        children: React.ReactNode;
        href: string;
        title?: string;
    }) => (
        <a href={href} title={title}>
            {children}
        </a>
    ),
}));

vi.mock('@/shared/lib/cardStyles', () => ({
    CARD_LINK_CLASSES: 'card-link-mock',
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/shared/lib/priceFormat', () => ({
    formatPriceChange: (percent: number) => ({
        sign: percent >= 0 ? '+' : '-',
        colorClass: percent >= 0 ? 'text-green' : 'text-red',
        arrow: percent >= 0 ? '▲' : '▼',
        arrowLabel: percent >= 0 ? '상승' : '하락',
    }),
    formatUsdPrice: (price: number) => price.toFixed(2),
}));

const INDEX_DATA: MarketIndexData = {
    symbol: 'SPY',
    fmpSymbol: '^GSPC',
    koreanName: 'S&P 500',
    displayName: 'S&P 500 Index',
    price: 5012.34,
    changesPercentage: 1.25,
};

const SECTOR_DATA: MarketSectorData = {
    symbol: 'XLK',
    sectorName: 'Technology',
    koreanName: '기술',
    price: 200.5,
    changesPercentage: -0.75,
};

describe('IndexCard', () => {
    it('renders symbol and price', () => {
        render(<IndexCard data={INDEX_DATA} />);
        expect(screen.getByText('SPY')).toBeInTheDocument();
        expect(screen.getByText('$5012.34')).toBeInTheDocument();
    });

    it('renders korean name', () => {
        render(<IndexCard data={INDEX_DATA} />);
        expect(screen.getByText('S&P 500')).toBeInTheDocument();
    });

    it('renders percentage change', () => {
        render(<IndexCard data={INDEX_DATA} />);
        expect(screen.getByText(/1\.25%/)).toBeInTheDocument();
    });

    it('wraps in a Link when href is provided', () => {
        render(<IndexCard data={INDEX_DATA} href="/SPY" />);
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/SPY');
        expect(link).toHaveAttribute('title', 'S&P 500 Index 분석');
    });

    it('does not wrap in a Link when href is absent', () => {
        render(<IndexCard data={INDEX_DATA} />);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('uses sectorName as label for sector data', () => {
        render(<IndexCard data={SECTOR_DATA} href="/XLK" />);
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('title', 'Technology 분석');
    });
});
