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
}));

import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { SymbolTabs } from '@/widgets/symbol-page/SymbolTabs';

describe('SymbolTabs', () => {
    beforeEach(() => {
        (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/AAPL');
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
});
