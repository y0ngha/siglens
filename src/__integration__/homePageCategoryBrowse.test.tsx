// 관심종목 ★는 React Query(`useWatchlist`)를 쓴다 — 이 테스트의 관심사가 아니라 비운다.
vi.mock('@/features/watchlist/ui/WatchlistPillToggle', () => ({
    WatchlistPillToggle: () => null,
}));
vi.mock('@/features/watchlist/ui/WatchlistPillScope', () => ({
    WatchlistPillScope: ({
        children,
    }: {
        children: import('react').ReactNode;
    }) => children,
}));

import { render, screen } from '@testing-library/react';
import { PopularTickers } from '@/widgets/home/PopularTickers';

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
    // 목이 KR 카테고리를 갖지 않으므로 빈 집합이다 — `PopularTickers`가 한국
    // 탭을 만들지 않고, 이 파일들은 미국 그리드만 검증한다.
    KR_CATEGORY_IDS: new Set<string>(),
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
        render(<PopularTickers />);
        expect(screen.getByText('Mega Cap')).toBeInTheDocument();
        expect(screen.getByText('AI & Semiconductor')).toBeInTheDocument();
    });

    it('renders ticker links within each category', () => {
        render(<PopularTickers />);
        const aaplLink = screen.getByRole('link', { name: /AAPL/ });
        expect(aaplLink).toHaveAttribute('href', '/AAPL');
        const nvdaLink = screen.getByRole('link', { name: /NVDA/ });
        expect(nvdaLink).toHaveAttribute('href', '/NVDA');
    });

    it('renders accessible nav landmark named by the section heading', () => {
        render(<PopularTickers />);
        expect(
            screen.getByRole('navigation', { name: '인기 종목' })
        ).toBeInTheDocument();
    });

    it('renders section heading and market tabs without a KR tab when KR has no categories', () => {
        render(<PopularTickers />);
        expect(
            screen.getByRole('heading', { level: 2, name: '인기 종목' })
        ).toBeInTheDocument();
        expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
            '미국 주식',
            '암호화폐',
        ]);
    });

    it('each US category has an accessible list', () => {
        render(<PopularTickers />);
        expect(
            screen.getByRole('list', { name: /Mega Cap 종목 목록/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('list', { name: /AI & Semiconductor 종목 목록/ })
        ).toBeInTheDocument();
    });

    it('ticker links have title attribute for SEO', () => {
        render(<PopularTickers />);
        const aaplLink = screen.getByRole('link', { name: /AAPL/ });
        expect(aaplLink).toHaveAttribute('title', 'AAPL 분석');
    });
});
