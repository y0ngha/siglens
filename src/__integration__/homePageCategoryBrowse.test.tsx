import { render, screen } from '@testing-library/react';
import { TickerCategories } from '@/widgets/home/TickerCategories';

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

vi.mock('@/shared/config/popular-tickers', () => ({
    TICKER_CATEGORIES: [
        {
            id: 'megacap',
            label: 'Mega Cap',
            items: [
                { symbol: 'AAPL', name: 'Apple' },
                { symbol: 'MSFT', name: 'Microsoft' },
                { symbol: 'GOOGL', name: 'Alphabet' },
            ],
        },
        {
            id: 'ai-semiconductor',
            label: 'AI & Semiconductor',
            items: [
                { symbol: 'NVDA', name: 'Nvidia' },
                { symbol: 'AMD', name: 'AMD' },
            ],
        },
    ],
}));

describe('Home Page Category Browse', () => {
    it('renders all categories', () => {
        render(<TickerCategories />);
        expect(screen.getByText('Mega Cap')).toBeInTheDocument();
        expect(screen.getByText('AI & Semiconductor')).toBeInTheDocument();
    });

    it('renders ticker links within each category', () => {
        render(<TickerCategories />);
        const aaplLink = screen.getByRole('link', { name: /AAPL/ });
        expect(aaplLink).toHaveAttribute('href', '/AAPL');
        const nvdaLink = screen.getByRole('link', { name: /NVDA/ });
        expect(nvdaLink).toHaveAttribute('href', '/NVDA');
    });

    it('renders accessible nav landmark', () => {
        render(<TickerCategories />);
        expect(
            screen.getByRole('navigation', { name: '섹터별 인기 종목 탐색' })
        ).toBeInTheDocument();
    });

    it('renders section heading', () => {
        render(<TickerCategories />);
        expect(
            screen.getByRole('heading', { name: '섹터별 인기 종목' })
        ).toBeInTheDocument();
    });

    it('each category has an accessible list', () => {
        render(<TickerCategories />);
        const lists = screen.getAllByRole('list');
        expect(lists.length).toBe(2);
    });

    it('ticker links have title attribute for SEO', () => {
        render(<TickerCategories />);
        const aaplLink = screen.getByRole('link', { name: /AAPL/ });
        expect(aaplLink).toHaveAttribute('title', 'AAPL 분석');
    });
});
