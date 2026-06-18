import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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

import { NewsCategoryTabs } from '../NewsCategoryTabs';

describe('NewsCategoryTabs', () => {
    it('renders all five category tabs with correct hrefs', () => {
        render(<NewsCategoryTabs activeCategory="stock" />);

        const expected: Record<string, string> = {
            일반: '/news/general',
            주식: '/news/stock',
            암호화폐: '/news/crypto',
            외환: '/news/forex',
            아티클: '/news/articles',
        };

        for (const [label, href] of Object.entries(expected)) {
            const link = screen.getByRole('link', { name: label });
            expect(link).toHaveAttribute('href', href);
        }
    });

    it('renders tabs in the canonical left-to-right category order', () => {
        render(<NewsCategoryTabs activeCategory="stock" />);

        const labelsInOrder = screen
            .getAllByRole('link')
            .map(l => l.textContent);
        expect(labelsInOrder).toEqual([
            '일반',
            '주식',
            '암호화폐',
            '외환',
            '아티클',
        ]);
    });

    it('marks only the active category with aria-current="page"', () => {
        render(<NewsCategoryTabs activeCategory="crypto" />);

        expect(screen.getByRole('link', { name: '암호화폐' })).toHaveAttribute(
            'aria-current',
            'page'
        );
        expect(screen.getByRole('link', { name: '주식' })).not.toHaveAttribute(
            'aria-current'
        );
    });

    it('exposes a labelled navigation landmark that scrolls horizontally on narrow viewports', () => {
        render(<NewsCategoryTabs activeCategory="general" />);

        const nav = screen.getByRole('navigation', { name: '뉴스 카테고리' });
        expect(nav).toBeInTheDocument();
        // overflow-x-auto is what prevents the 5 tabs from overflowing at 375px.
        expect(nav.className).toContain('overflow-x-auto');
    });
});
