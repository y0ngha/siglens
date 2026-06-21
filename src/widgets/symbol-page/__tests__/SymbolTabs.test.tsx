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

vi.mock('@/widgets/symbol-page/utils/symbolTabsConfig', () => ({
    TABS: [
        { key: 'chart', label: '차트', hrefBuilder: (s: string) => `/${s}` },
        {
            key: 'news',
            label: '뉴스',
            hrefBuilder: (s: string) => `/${s}/news`,
        },
        {
            key: 'fundamental',
            label: '펀더멘털',
            hrefBuilder: (s: string) => `/${s}/fundamental`,
        },
    ],
    tabsFor: (profile: string) => {
        const all = [
            {
                key: 'chart',
                label: '차트',
                hrefBuilder: (s: string) => `/${s}`,
            },
            {
                key: 'news',
                label: '뉴스',
                hrefBuilder: (s: string) => `/${s}/news`,
            },
            {
                key: 'fundamental',
                label: '펀더멘털',
                hrefBuilder: (s: string) => `/${s}/fundamental`,
            },
        ];
        return profile === 'crypto'
            ? all.filter(t => ['chart', 'news'].includes(t.key))
            : all;
    },
}));

vi.mock('@/widgets/symbol-page/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(),
}));

import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { useAssetInfo } from '@/widgets/symbol-page/hooks/useAssetInfo';
import { SymbolTabs } from '@/widgets/symbol-page/SymbolTabs';
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
        expect(screen.getByText('차트')).toBeDefined();
        expect(screen.getByText('뉴스')).toBeDefined();
        expect(screen.getByText('펀더멘털')).toBeDefined();
    });

    it('marks the active tab with aria-current="page"', () => {
        render(<SymbolTabs symbol="aapl" />);
        const chartLink = screen.getByText('차트').closest('a')!;
        expect(chartLink.getAttribute('aria-current')).toBe('page');
    });

    it('does not mark inactive tabs with aria-current', () => {
        render(<SymbolTabs symbol="aapl" />);
        const newsLink = screen.getByText('뉴스').closest('a')!;
        expect(newsLink.getAttribute('aria-current')).toBeNull();
    });

    it('uppercases the symbol for href building', () => {
        render(<SymbolTabs symbol="aapl" />);
        const newsLink = screen.getByText('뉴스').closest('a')!;
        expect(newsLink.getAttribute('href')).toBe('/AAPL/news');
    });

    it('marks different tab as active based on pathname', () => {
        (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/AAPL/news');

        render(<SymbolTabs symbol="aapl" />);
        const newsLink = screen.getByText('뉴스').closest('a')!;
        expect(newsLink.getAttribute('aria-current')).toBe('page');

        const chartLink = screen.getByText('차트').closest('a')!;
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
});
