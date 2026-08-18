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
vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/market'),
}));
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { usePathname } from 'next/navigation';

import { HeaderNav } from '../HeaderNav';
import { NAV_TREE } from '../headerNavTree';

/** 버티컬 1단 트리거(버튼)를 라벨로 집는다. */
function trigger(label: string) {
    return screen.getByRole('button', { name: new RegExp(label) });
}

/** 같은 라벨(`미국`/`한국`)이 버티컬마다 반복되므로 href로 특정한다. */
function linkByHref(href: string): HTMLElement {
    const found = screen
        .getAllByRole('link')
        .find(link => link.getAttribute('href') === href);
    if (!found) throw new Error(`no nav link for ${href}`);
    return found;
}

describe('HeaderNav', () => {
    it('renders one dropdown trigger per vertical', () => {
        render(<HeaderNav items={NAV_TREE} />);

        for (const vertical of NAV_TREE) {
            expect(trigger(vertical.label)).toBeInTheDocument();
        }
    });

    it('keeps every region link in the DOM while the panel is closed', () => {
        // 헤더는 전 페이지에 렌더되므로 신규 지역 페이지로 가는 사실상 유일한 전역
        // 앵커다. 조건부 렌더로 감추면 크롤러가 그 링크를 영영 못 본다.
        render(<HeaderNav items={NAV_TREE} />);

        expect(linkByHref('/market/kr')).toHaveTextContent('한국');
        expect(linkByHref('/news/crypto')).toHaveTextContent('암호화폐');
        expect(linkByHref('/economy/kr')).toHaveTextContent('한국');
    });

    it('starts closed (aria-expanded=false) and hides the panel visually', () => {
        render(<HeaderNav items={NAV_TREE} />);

        const marketTrigger = trigger('시장 분석');
        expect(marketTrigger).toHaveAttribute('aria-expanded', 'false');
        const panelId = marketTrigger.getAttribute('aria-controls');
        expect(panelId).toBeTruthy();
        // `invisible`(visibility:hidden)이라 마크업에는 남고 탭 포커스에서는 빠진다.
        expect(document.getElementById(panelId as string)).toHaveClass(
            'invisible'
        );
    });

    it('marks the vertical active when the current path is one of its regions', () => {
        render(<HeaderNav items={NAV_TREE} />);

        expect(trigger('시장 분석').className).toContain('border-primary-500');
        expect(trigger('뉴스').className).not.toContain('border-primary-500');
    });

    it('sets aria-current only on the exact region link', () => {
        render(<HeaderNav items={NAV_TREE} />);

        const marketPanel = document.getElementById(
            trigger('시장 분석').getAttribute('aria-controls') as string
        ) as HTMLElement;
        const usLink = within(marketPanel).getByRole('link', { name: '미국' });
        const krLink = within(marketPanel).getByRole('link', { name: '한국' });

        expect(usLink).toHaveAttribute('aria-current', 'page');
        // `/market`은 `/market/kr`의 접두사다 — 접두사 매칭을 쓰면 한국 탭도 활성이 된다.
        expect(krLink).not.toHaveAttribute('aria-current');
    });

    it('keeps the vertical active on a child route that is not in the tree', () => {
        vi.mocked(usePathname).mockReturnValue('/news/general');

        render(<HeaderNav items={NAV_TREE} />);

        expect(trigger('뉴스').className).toContain('border-primary-500');
    });

    it('exposes the US news categories as second-level links', () => {
        // 지역 허브를 한 번 더 거치지 않고 헤더에서 곧장 카테고리로 가는 것이
        // 이 메뉴의 존재 이유다.
        render(<HeaderNav items={NAV_TREE} />);

        expect(linkByHref('/news/stock')).toHaveTextContent('미국 주식');
    });

    it('has a navigation landmark', () => {
        render(<HeaderNav items={NAV_TREE} />);

        expect(
            screen.getByRole('navigation', { name: /주요 네비게이션/ })
        ).toBeInTheDocument();
    });
});
