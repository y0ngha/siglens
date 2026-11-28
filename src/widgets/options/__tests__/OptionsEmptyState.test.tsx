import { render, screen } from '@testing-library/react';
import {
    SymbolBottomAdProvider,
    useSymbolBottomAdSuppressed,
} from '@/features/ad-slot/model/SymbolBottomAdContext';
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

    it.each(['TSLA', '삼성전자', '셀트리온'])(
        '조사는 받침과 무관한 "에는"이다 (%s)',
        symbol => {
            render(<OptionsEmptyState symbol={symbol} />);
            expect(
                screen.getByText(
                    `${symbol}에는 현재 옵션 시장이 형성되어 있지 않습니다.`,
                    { exact: false }
                )
            ).toBeInTheDocument();
        }
    );

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

    it('renders snapshotSlot when provided (Task 7b — SEO snapshot prose composed by the caller)', () => {
        render(
            <OptionsEmptyState
                symbol="TSLA"
                snapshotSlot={<div data-testid="snapshot-slot-stub" />}
            />
        );
        expect(screen.getByTestId('snapshot-slot-stub')).toBeInTheDocument();
    });

    it('renders nothing extra when snapshotSlot is omitted (existing behavior unchanged)', () => {
        const { container } = render(<OptionsEmptyState symbol="TSLA" />);
        expect(
            container.querySelector('[data-testid="snapshot-slot-stub"]')
        ).toBeNull();
    });
});

// 옵션 시장이 없다는 안내 화면은 링크 카드뿐이라 AdSense가 광고를 금지하는 "내용 없는 화면"이다.
describe('OptionsEmptyState — shared bottom ad', () => {
    function AdProbe() {
        return (
            <p data-testid="bottom-ad">
                {useSymbolBottomAdSuppressed() ? 'suppressed' : 'open'}
            </p>
        );
    }

    it('suppresses the layout bottom ad', () => {
        render(
            <SymbolBottomAdProvider>
                <OptionsEmptyState symbol="TSLA" />
                <AdProbe />
            </SymbolBottomAdProvider>
        );
        expect(screen.getByTestId('bottom-ad')).toHaveTextContent('suppressed');
    });
});
