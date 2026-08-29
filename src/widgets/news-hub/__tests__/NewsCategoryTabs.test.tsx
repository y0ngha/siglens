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

        // 현재 카테고리(주식)는 링크가 아니다 — 아래 전용 케이스 참고.
        const expected: Record<string, string> = {
            일반: '/news/general',
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

        // 링크만 세면 현재 탭이 빠져 순서 검증이 무의미해진다 — nav의 자식을
        // 그대로 읽는다.
        const nav = screen.getByRole('navigation', { name: '뉴스 카테고리' });
        const labelsInOrder = [...nav.children].map(el => el.textContent);
        expect(labelsInOrder).toEqual(['일반', '주식', '외환', '아티클']);
    });

    it('renders nothing when the region has a single category', () => {
        // 선택지가 없는 탭 하나는 정보가 0이고 세로 공간만 먹는다.
        const { container } = render(<NewsCategoryTabs activeCategory="kr" />);
        expect(container).toBeEmptyDOMElement();

        const cryptoOnly = render(<NewsCategoryTabs activeCategory="crypto" />);
        expect(cryptoOnly.container).toBeEmptyDOMElement();
    });

    /**
     * 현재 카테고리는 `<span aria-current="page">`이고 링크가 아니다.
     *
     * `<Link>`로 두면 자기 자신을 가리키는 죽은 앵커가 되어 내부 링크 그래프에
     * 자기 참조가 들어간다(감사 실측: /news/stock의 내부 링크 집합에
     * '/news/stock' 포함). 형제인 `shared/ui/RegionTabs`가 이미 같은 이유로
     * 같은 형태를 쓴다 — 두 탭 줄이 한 화면에 같이 있으므로 어긋나면 눈에 띈다.
     */
    it('현재 카테고리는 링크가 아니라 aria-current 텍스트다', () => {
        render(<NewsCategoryTabs activeCategory="forex" />);

        expect(
            screen.queryByRole('link', { name: '외환' })
        ).not.toBeInTheDocument();
        const current = screen.getByText('외환');
        expect(current.tagName).toBe('SPAN');
        expect(current).toHaveAttribute('aria-current', 'page');

        // 나머지는 여전히 링크이고 aria-current가 없다.
        const other = screen.getByRole('link', { name: '주식' });
        expect(other).toHaveAttribute('href', '/news/stock');
        expect(other).not.toHaveAttribute('aria-current');
    });

    it('현재 카테고리 URL이 내부 링크 집합에 없다', () => {
        render(<NewsCategoryTabs activeCategory="stock" />);
        const hrefs = screen
            .getAllByRole('link')
            .map(l => l.getAttribute('href'));
        expect(hrefs).not.toContain('/news/stock');
    });

    it('exposes a labelled navigation landmark that scrolls horizontally on narrow viewports', () => {
        render(<NewsCategoryTabs activeCategory="general" />);

        const nav = screen.getByRole('navigation', { name: '뉴스 카테고리' });
        expect(nav).toBeInTheDocument();
        // overflow-x-auto is what prevents the 5 tabs from overflowing at 375px.
        expect(nav.className).toContain('overflow-x-auto');
    });
});
