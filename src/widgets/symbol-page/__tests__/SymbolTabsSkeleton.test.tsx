import { render, screen } from '@testing-library/react';
import { SymbolTabsSkeleton } from '@/widgets/symbol-page/SymbolTabsSkeleton';

vi.mock('@/widgets/symbol-page/utils/symbolTabsConfig', () => ({
    TABS: [
        { key: 'chart', label: '차트', hrefBuilder: (s: string) => `/${s}` },
        {
            key: 'news',
            label: '뉴스',
            hrefBuilder: (s: string) => `/${s}/news`,
        },
    ],
}));

describe('SymbolTabsSkeleton', () => {
    it('renders a nav element with aria-hidden', () => {
        render(<SymbolTabsSkeleton />);
        const nav = screen.getByRole('navigation', { hidden: true });
        expect(nav.getAttribute('aria-hidden')).toBe('true');
    });

    it('renders labels for each tab', () => {
        render(<SymbolTabsSkeleton />);
        expect(screen.getByText('차트')).toBeDefined();
        expect(screen.getByText('뉴스')).toBeDefined();
    });

    it('renders spans (not links)', () => {
        const { container } = render(<SymbolTabsSkeleton />);
        const links = container.querySelectorAll('a');
        expect(links).toHaveLength(0);

        const spans = container.querySelectorAll('span');
        expect(spans.length).toBe(2);
    });
});
