import { render, screen } from '@testing-library/react';
import { CrossLinkCards } from '@/widgets/symbol-page/CrossLinkCards';

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
        expect(section).toBeDefined();
    });

    it('renders 6 cards (all pages)', () => {
        const { container } = render(
            <CrossLinkCards symbol="AAPL" current="chart" />
        );
        const children = container.querySelector('section')!.children;
        expect(children).toHaveLength(6);
    });

    it('marks the current page card with aria-current="page"', () => {
        render(<CrossLinkCards symbol="AAPL" current="chart" />);
        const current = screen.getByText('차트 분석').closest('[aria-current]');
        expect(current?.getAttribute('aria-current')).toBe('page');
    });

    it('renders the current page label text', () => {
        render(<CrossLinkCards symbol="AAPL" current="chart" />);
        expect(screen.getByText('지금 보는 페이지예요')).toBeDefined();
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
        expect(screen.getByText('기술적 지표 + AI 종합 리포트')).toBeDefined();
        expect(
            screen.getByText('실시간 뉴스 + 애널리스트 의견 분석')
        ).toBeDefined();
    });
});
