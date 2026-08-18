// vi.mock → imports 순서 (MISTAKES.md Tests §17)
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

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NewsCategoryTabs } from '../NewsCategoryTabs';

describe('NewsCategoryTabs', () => {
    it('renders only the same-region categories with correct hrefs', () => {
        // 지역(미국·한국·암호화폐)은 위쪽 `RegionTabs`가 이미 고른다 — 여기에 전
        // 지역을 섞으면 한 화면에 지역 선택기가 둘이 된다.
        render(<NewsCategoryTabs activeCategory="stock" />);

        const expected: Record<string, string> = {
            일반: '/news/general',
            주식: '/news/stock',
            외환: '/news/forex',
            아티클: '/news/articles',
        };

        for (const [label, href] of Object.entries(expected)) {
            const link = screen.getByRole('link', { name: label });
            expect(link).toHaveAttribute('href', href);
        }
        expect(
            screen.queryByRole('link', { name: '암호화폐' })
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: '국내 증시' })
        ).not.toBeInTheDocument();
    });

    it('renders tabs in the canonical left-to-right category order', () => {
        render(<NewsCategoryTabs activeCategory="stock" />);

        const labelsInOrder = screen
            .getAllByRole('link')
            .map(l => l.textContent);
        expect(labelsInOrder).toEqual(['일반', '주식', '외환', '아티클']);
    });

    it('renders nothing when the region has a single category', () => {
        // 선택지가 없는 탭 하나는 정보가 0이고 세로 공간만 먹는다.
        const { container } = render(<NewsCategoryTabs activeCategory="kr" />);
        expect(container).toBeEmptyDOMElement();

        const cryptoOnly = render(<NewsCategoryTabs activeCategory="crypto" />);
        expect(cryptoOnly.container).toBeEmptyDOMElement();
    });

    it('marks only the active category with aria-current="page"', () => {
        render(<NewsCategoryTabs activeCategory="forex" />);

        expect(screen.getByRole('link', { name: '외환' })).toHaveAttribute(
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
