import { render, screen } from '@testing-library/react';
import { SymbolTabs } from '@/views/symbol/SymbolTabs';
import { TABS } from '@/views/symbol/utils/symbolTabsConfig';
import type { AssetInfo } from '@/shared/lib/types';
import { withLocale } from '@/shared/test-utils/intlRenderWrapper';
import koMessages from '@/../messages/ko.json';
import enMessages from '@/../messages/en.json';

let mockPathname = '/AAPL';

vi.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
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

// useAssetInfo returns a resolved equity asset so all us-equity tabs are rendered.
// (undefined = loading → shows placeholder div; null = unknown → shows us-equity tabs)
const EQUITY_ASSET: AssetInfo = { symbol: 'AAPL', name: 'Apple Inc.' };
vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(() => EQUITY_ASSET),
}));

describe('Symbol Tab Navigation', () => {
    beforeEach(() => {
        mockPathname = '/AAPL';
    });

    it('renders all tab links for a symbol', () => {
        render(<SymbolTabs symbol="AAPL" />);
        for (const tab of TABS) {
            expect(
                screen.getByText(koMessages.shared.symbolTab[tab.labelKey])
            ).toBeInTheDocument();
        }
    });

    /**
     * 탭바는 사이트에서 가장 눈에 띄는 내비게이션인데 전 로케일에서 한국어로
     * 남아 있었다 — `aria-label`은 번역되면서 라벨은 모듈 스코프 상수라
     * 추출 대상이 아니었다.
     */
    it('비-ko 로케일에서는 한국어 탭 라벨이 남지 않는다', () => {
        render(withLocale(<SymbolTabs symbol="AAPL" />, 'en'));

        for (const tab of TABS) {
            expect(
                screen.getByText(enMessages.shared.symbolTab[tab.labelKey])
            ).toBeInTheDocument();
        }
        expect(
            screen.queryByText(koMessages.shared.symbolTab.chart)
        ).not.toBeInTheDocument();
    });

    it('marks the chart tab as current when on /{symbol}', () => {
        mockPathname = '/AAPL';
        render(<SymbolTabs symbol="AAPL" />);
        const chartLink = screen.getByText('차트');
        expect(chartLink).toHaveAttribute('aria-current', 'page');
    });

    it('marks the news tab as current when on /{symbol}/news', () => {
        mockPathname = '/AAPL/news';
        render(<SymbolTabs symbol="AAPL" />);
        const newsLink = screen.getByText('뉴스');
        expect(newsLink).toHaveAttribute('aria-current', 'page');
        const chartLink = screen.getByText('차트');
        expect(chartLink).not.toHaveAttribute('aria-current');
    });

    it('marks the fundamental tab as current when on /{symbol}/fundamental', () => {
        mockPathname = '/AAPL/fundamental';
        render(<SymbolTabs symbol="AAPL" />);
        expect(screen.getByText('펀더멘털')).toHaveAttribute(
            'aria-current',
            'page'
        );
    });

    it('marks the options tab as current when on /{symbol}/options', () => {
        mockPathname = '/AAPL/options';
        render(<SymbolTabs symbol="AAPL" />);
        expect(screen.getByText('옵션')).toHaveAttribute(
            'aria-current',
            'page'
        );
    });

    it('marks the fear-greed tab as current', () => {
        mockPathname = '/AAPL/fear-greed';
        render(<SymbolTabs symbol="AAPL" />);
        expect(screen.getByText('공포 탐욕 지수')).toHaveAttribute(
            'aria-current',
            'page'
        );
    });

    it('marks the overall tab as current', () => {
        mockPathname = '/AAPL/overall';
        render(<SymbolTabs symbol="AAPL" />);
        expect(screen.getByText('종합')).toHaveAttribute(
            'aria-current',
            'page'
        );
    });

    it('generates correct hrefs with uppercased symbol', () => {
        render(<SymbolTabs symbol="aapl" />);
        const links = screen.getAllByRole('link');
        expect(links[0]).toHaveAttribute('href', '/AAPL');
        expect(links[1]).toHaveAttribute('href', '/AAPL/news');
    });

    it('has an accessible nav landmark', () => {
        render(<SymbolTabs symbol="AAPL" />);
        const nav = screen.getByRole('navigation', { name: '분석 종류' });
        expect(nav).toBeInTheDocument();
    });
});
