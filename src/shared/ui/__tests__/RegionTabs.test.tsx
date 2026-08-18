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
import { RegionTabs } from '../RegionTabs';
import { regionsOf } from '@/shared/config/assetClassNav';

describe('RegionTabs', () => {
    it('renders one entry per region of the vertical', () => {
        render(
            <RegionTabs vertical="news" active="us" currentPath="/news/us" />
        );

        const nav = screen.getByRole('navigation', { name: '지역 선택' });
        expect(nav.children).toHaveLength(regionsOf('news').length);
    });

    it('renders the active region as text, not a link', () => {
        // 현재 페이지로 가는 링크는 클릭해도 아무 일이 없는 죽은 앵커이고,
        // 내부 링크 그래프에서 자기 참조를 만든다.
        render(
            <RegionTabs vertical="market" active="us" currentPath="/market" />
        );

        expect(
            screen.queryByRole('link', { name: '미국' })
        ).not.toBeInTheDocument();
        const current = screen.getByText('미국');
        expect(current.tagName).toBe('SPAN');
        expect(current).toHaveAttribute('aria-current', 'page');
    });

    it('links every inactive region to its page', () => {
        render(
            <RegionTabs vertical="market" active="us" currentPath="/market" />
        );

        const kr = screen.getByRole('link', { name: '한국' });
        expect(kr).toHaveAttribute('href', '/market/kr');
        expect(kr).not.toHaveAttribute('aria-current');
    });

    it('swaps which entry is a link when the active region changes', () => {
        render(
            <RegionTabs
                vertical="market"
                active="kr"
                currentPath="/market/kr"
            />
        );

        expect(screen.getByRole('link', { name: '미국' })).toHaveAttribute(
            'href',
            '/market'
        );
        expect(
            screen.queryByRole('link', { name: '한국' })
        ).not.toBeInTheDocument();
    });

    it('exposes all three regions for 뉴스', () => {
        render(
            <RegionTabs vertical="news" active="kr" currentPath="/news/kr" />
        );

        expect(screen.getByRole('link', { name: '미국' })).toHaveAttribute(
            'href',
            '/news/us'
        );
        expect(screen.getByRole('link', { name: '암호화폐' })).toHaveAttribute(
            'href',
            '/news/crypto'
        );
    });
    /**
     * 지역에 속하지만 지역 허브는 **아닌** 페이지가 있다 — `/news/general`은
     * `region === 'us'`지만 `/news/us`가 아니다. 여기서 미국 탭을 현재 페이지로
     * 표기하면 (a) 현재 페이지가 아닌 URL에 `aria-current`가 붙고 (b) 그 네 개
     * 카테고리 페이지가 자기 지역 허브로 가는 링크를 잃는다.
     */
    it('지역 안의 하위 페이지에서는 지역 탭이 링크로 남는다', () => {
        render(
            <RegionTabs
                vertical="news"
                active="us"
                currentPath="/news/general"
            />
        );

        const us = screen.getByRole('link', { name: '미국' });
        expect(us).toHaveAttribute('href', '/news/us');
        expect(
            document.querySelector('[aria-current="page"]')
        ).not.toBeInTheDocument();
    });
});
