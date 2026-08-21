import koMessages from '@/../messages/ko.json';
vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/AAPL'),
}));

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

vi.mock('@/views/symbol/utils/symbolTabsConfig', () => ({
    TABS: [
        {
            key: 'chart',
            labelKey: 'chart',
            hrefBuilder: (s: string) => `/${s}`,
        },
        {
            key: 'news',
            labelKey: 'news',
            hrefBuilder: (s: string) => `/${s}/news`,
        },
        {
            key: 'fundamental',
            labelKey: 'fundamental',
            hrefBuilder: (s: string) => `/${s}/fundamental`,
        },
    ],
    tabsFor: (profile: string) => {
        const all = [
            {
                key: 'chart',
                labelKey: 'chart',
                hrefBuilder: (s: string) => `/${s}`,
            },
            {
                key: 'news',
                labelKey: 'news',
                hrefBuilder: (s: string) => `/${s}/news`,
            },
            {
                key: 'fundamental',
                labelKey: 'fundamental',
                hrefBuilder: (s: string) => `/${s}/fundamental`,
            },
        ];
        return profile === 'crypto'
            ? all.filter(t => ['chart', 'news'].includes(t.key))
            : all;
    },
}));

vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(),
}));

import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import { SymbolTabs } from '@/views/symbol/SymbolTabs';
import type { AssetInfo } from '@/shared/lib/types';

const EQUITY_ASSET: AssetInfo = { symbol: 'AAPL', name: 'Apple Inc.' };

describe('SymbolTabs', () => {
    beforeEach(() => {
        (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/AAPL');
        // Default: resolved equity asset so most tests see the full tab bar.
        (useAssetInfo as ReturnType<typeof vi.fn>).mockReturnValue(
            EQUITY_ASSET
        );
    });

    it('renders a nav with accessible label', () => {
        render(<SymbolTabs symbol="aapl" />);
        const nav = screen.getByRole('navigation', { name: '분석 종류' });
        expect(nav).toBeDefined();
    });

    it('renders all tab links', () => {
        render(<SymbolTabs symbol="aapl" />);
        expect(
            screen.getByText(koMessages.shared.symbolTab.chart)
        ).toBeDefined();
        expect(
            screen.getByText(koMessages.shared.symbolTab.news)
        ).toBeDefined();
        expect(
            screen.getByText(koMessages.shared.symbolTab.fundamental)
        ).toBeDefined();
    });

    it('marks the active tab with aria-current="page"', () => {
        render(<SymbolTabs symbol="aapl" />);
        const chartLink = screen
            .getByText(koMessages.shared.symbolTab.chart)
            .closest('a')!;
        expect(chartLink.getAttribute('aria-current')).toBe('page');
    });

    it('does not mark inactive tabs with aria-current', () => {
        render(<SymbolTabs symbol="aapl" />);
        const newsLink = screen
            .getByText(koMessages.shared.symbolTab.news)
            .closest('a')!;
        expect(newsLink.getAttribute('aria-current')).toBeNull();
    });

    it('uppercases the symbol for href building', () => {
        render(<SymbolTabs symbol="aapl" />);
        const newsLink = screen
            .getByText(koMessages.shared.symbolTab.news)
            .closest('a')!;
        expect(newsLink.getAttribute('href')).toBe('/AAPL/news');
    });

    it('marks different tab as active based on pathname', () => {
        (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/AAPL/news');

        render(<SymbolTabs symbol="aapl" />);
        const newsLink = screen
            .getByText(koMessages.shared.symbolTab.news)
            .closest('a')!;
        expect(newsLink.getAttribute('aria-current')).toBe('page');

        const chartLink = screen
            .getByText(koMessages.shared.symbolTab.chart)
            .closest('a')!;
        expect(chartLink.getAttribute('aria-current')).toBeNull();
    });

    it('renders a loading placeholder div when assetInfo is undefined (loading)', () => {
        (useAssetInfo as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
        const { container } = render(<SymbolTabs symbol="aapl" />);
        // No nav rendered while loading — placeholder div is shown instead.
        expect(screen.queryByRole('navigation')).toBeNull();
        const placeholder = container.querySelector(
            '.border-secondary-700.h-11.border-b'
        );
        expect(placeholder).not.toBeNull();
    });

    it('assetInfo가 null(미지 심볼)이면 us-equity 전체 탭 세트를 렌더한다 (로딩 placeholder 아님, 크립토 필터링 없음)', () => {
        // null = the query resolved but no matching asset found (unknown symbol).
        // SymbolTabs should fall back to DEFAULT_MARKET_PROFILE (us-equity)
        // and render the full tab set — not the loading placeholder, not a
        // crypto-filtered subset.
        (useAssetInfo as ReturnType<typeof vi.fn>).mockReturnValue(null);
        render(<SymbolTabs symbol="UNKNOWN" />);
        // The nav must be present (not the loading placeholder).
        expect(
            screen.getByRole('navigation', { name: '분석 종류' })
        ).toBeDefined();
        // Equity-only tabs must be present (they would be absent for crypto).
        expect(
            screen.getByText(koMessages.shared.symbolTab.fundamental)
        ).toBeDefined();
        // Crypto-shared tabs are also present.
        expect(
            screen.getByText(koMessages.shared.symbolTab.chart)
        ).toBeDefined();
        expect(
            screen.getByText(koMessages.shared.symbolTab.news)
        ).toBeDefined();
    });
});

describe('SymbolTabs — 로케일 접두사', () => {
    /**
     * 탭 href는 접두사가 없는 `/AAPL/news` 형태다. 접두사가 붙은 경로로 비교하면
     * en/ja/zh 사용자에게 활성 탭 표시와 `aria-current`가 통째로 꺼진다
     * (시각·a11y 회귀라 에러 없이 조용히 지나간다).
     */
    it.each([
        ['/en/AAPL', '차트'],
        ['/ja/AAPL/news', '뉴스'],
    ])('%s에서도 활성 탭을 표시한다', (pathname, label) => {
        (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(pathname);
        render(<SymbolTabs symbol="AAPL" />);
        expect(
            screen.getByRole('link', { name: label, current: 'page' })
        ).toBeInTheDocument();
    });
});
