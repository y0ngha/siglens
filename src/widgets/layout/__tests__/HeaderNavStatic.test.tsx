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

import React from 'react';
import { render, screen } from '@testing-library/react';

import { HeaderNavStatic } from '../HeaderNavStatic';
import { NAV_TREE } from '../headerNavTree';
import { ALL_NAV_REGION_LINKS } from '@/shared/config/assetClassNav';

describe('HeaderNavStatic', () => {
    /**
     * 이 fallback이 곧 PPR 정적 셸이고, 크롤러가 보는 것도 그 셸이다.
     * 여기서 링크가 하나라도 빠지면 그 지역 페이지는 전역 앵커를 잃는다.
     */
    it('renders every region link the nav config declares', () => {
        render(<HeaderNavStatic items={NAV_TREE} />);

        for (const region of ALL_NAV_REGION_LINKS) {
            const links = screen.getAllByRole('link', {
                name: region.label,
            });
            expect(
                links.some(l => l.getAttribute('href') === region.href)
            ).toBe(true);
        }
    });

    it('renders every second-level destination too', () => {
        render(<HeaderNavStatic items={NAV_TREE} />);

        const leafHrefs = NAV_TREE.flatMap(v =>
            v.regions.flatMap(r => r.children.map(c => c.href))
        );
        expect(leafHrefs.length).toBeGreaterThan(0);

        const rendered = new Set(
            screen.getAllByRole('link').map(l => l.getAttribute('href'))
        );
        for (const href of leafHrefs) {
            expect(rendered).toContain(href);
        }
    });

    it('does not set aria-current on any item (no active state)', () => {
        render(<HeaderNavStatic items={NAV_TREE} />);

        for (const link of screen.getAllByRole('link')) {
            expect(link).not.toHaveAttribute('aria-current');
        }
    });

    it('has a navigation landmark', () => {
        render(<HeaderNavStatic items={NAV_TREE} />);

        expect(
            screen.getByRole('navigation', { name: /주요 네비게이션/ })
        ).toBeInTheDocument();
    });
});
