import { render, screen } from '@testing-library/react';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

describe('CrossLinkCards', () => {
    it('renders a section with accessible label', () => {
        render(<CrossLinkCards symbol="AAPL" current="chart" />);
        const section = screen.getByRole('region', { name: '다른 분석 탭' });
        expect(section).toBeInTheDocument();
    });

    it('renders 8 cards (all pages including financials and congress) for us-equity', () => {
        const { container } = render(
            <CrossLinkCards
                symbol="AAPL"
                current="chart"
                marketProfile="us-equity"
            />
        );
        const children = container.querySelector('section')!.children;
        expect(children).toHaveLength(8);
    });

    it('marks the current page card with aria-current="page"', () => {
        render(<CrossLinkCards symbol="AAPL" current="chart" />);
        const current = screen.getByText('차트 분석').closest('[aria-current]');
        expect(current?.getAttribute('aria-current')).toBe('page');
    });

    it('renders the current page label text', () => {
        render(<CrossLinkCards symbol="AAPL" current="chart" />);
        expect(screen.getByText('지금 보는 페이지예요')).toBeInTheDocument();
    });

    it('renders non-current pages as links', () => {
        render(<CrossLinkCards symbol="AAPL" current="chart" />);
        const newsLink = screen.getByText('뉴스 분석').closest('a');
        expect(newsLink).not.toBeNull();
        expect(newsLink!.getAttribute('href')).toBe('/AAPL/news');
    });

    it('does not render current page as a link', () => {
        render(<CrossLinkCards symbol="AAPL" current="chart" />);
        const chartEl = screen.getByText('차트 분석').closest('a');
        expect(chartEl).toBeNull();
    });

    it('builds correct hrefs for all non-current pages', () => {
        render(<CrossLinkCards symbol="TSLA" current="news" />);
        const chartLink = screen.getByText('차트 분석').closest('a');
        expect(chartLink!.getAttribute('href')).toBe('/TSLA');

        const fundamentalLink = screen.getByText('펀더멘털 분석').closest('a');
        expect(fundamentalLink!.getAttribute('href')).toBe('/TSLA/fundamental');
    });

    it('renders descriptions for all pages', () => {
        render(<CrossLinkCards symbol="AAPL" current="chart" />);
        expect(
            screen.getByText('기술적 지표 + AI 종합 리포트')
        ).toBeInTheDocument();
        expect(
            screen.getByText('실시간 뉴스 + 애널리스트 의견 분석')
        ).toBeInTheDocument();
    });
});

describe('CrossLinkCards — crypto profile', () => {
    it('renders only 4 cards (chart, news, fear-greed, overall) for crypto', () => {
        const { container } = render(
            <CrossLinkCards
                symbol="BTCUSD"
                current="chart"
                marketProfile="crypto"
            />
        );
        const children = container.querySelector('section')!.children;
        expect(children).toHaveLength(4);
    });

    it('does not render equity-only tabs (fundamental, financials, options, congress) for crypto', () => {
        render(
            <CrossLinkCards
                symbol="BTCUSD"
                current="chart"
                marketProfile="crypto"
            />
        );
        expect(screen.queryByText('펀더멘털 분석')).toBeNull();
        expect(screen.queryByText('재무제표')).toBeNull();
        expect(screen.queryByText('옵션 분석')).toBeNull();
        expect(screen.queryByText('의회 거래')).toBeNull();
    });

    it('renders crypto-specific overall description instead of 4축 copy', () => {
        render(
            <CrossLinkCards
                symbol="BTCUSD"
                current="chart"
                marketProfile="crypto"
            />
        );
        expect(screen.queryByText('4축 통합 AI 결론 + 시나리오')).toBeNull();
        expect(
            screen.getByText('차트·뉴스·시장 분위기 통합 AI 결론 + 시나리오')
        ).toBeInTheDocument();
    });

    it('still renders chart, news, fear-greed, overall tabs for crypto', () => {
        render(
            <CrossLinkCards
                symbol="BTCUSD"
                current="chart"
                marketProfile="crypto"
            />
        );
        expect(screen.getByText('뉴스 분석')).toBeInTheDocument();
        expect(screen.getByText('공포 탐욕 지수')).toBeInTheDocument();
        expect(screen.getByText('AI 종합 분석')).toBeInTheDocument();
    });
});
