import { render, screen } from '@testing-library/react';
import { OptionsEmptyState } from '@/widgets/options/OptionsEmptyState';

vi.mock('next/link', () => ({
    default: ({
        children,
        href,
    }: {
        children: React.ReactNode;
        href: string;
    }) => <a href={href}>{children}</a>,
}));

describe('OptionsEmptyState', () => {
    it('renders the symbol in the heading', () => {
        render(<OptionsEmptyState symbol="TSLA" />);
        expect(
            screen.getByRole('heading', { name: /TSLA 옵션 시장 정보 없음/ })
        ).toBeInTheDocument();
    });

    it('renders description text', () => {
        render(<OptionsEmptyState symbol="TSLA" />);
        expect(
            screen.getByText(/옵션 시장이 형성되어 있지 않습니다/)
        ).toBeInTheDocument();
    });

    it('renders fallback navigation links', () => {
        render(<OptionsEmptyState symbol="TSLA" />);
        const links = screen.getAllByRole('link');
        expect(links).toHaveLength(4);
    });

    it('creates correct hrefs for the symbol', () => {
        render(<OptionsEmptyState symbol="AAPL" />);
        const links = screen.getAllByRole('link');
        const hrefs = links.map(l => l.getAttribute('href'));
        expect(hrefs).toContain('/AAPL');
        expect(hrefs).toContain('/AAPL/fundamental');
        expect(hrefs).toContain('/AAPL/news');
        expect(hrefs).toContain('/AAPL/fear-greed');
    });

    it('renders all page labels', () => {
        render(<OptionsEmptyState symbol="AAPL" />);
        expect(screen.getByText('차트 분석')).toBeInTheDocument();
        expect(screen.getByText('펀더멘털 분석')).toBeInTheDocument();
        expect(screen.getByText('뉴스 분석')).toBeInTheDocument();
        expect(screen.getByText('공포 탐욕 지수')).toBeInTheDocument();
    });
});
