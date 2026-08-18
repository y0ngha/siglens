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
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));

import React from 'react';
import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { HeaderNavMenu } from '../HeaderNavMenu';
import { NAV_TREE } from '../headerNavTree';

const NEWS = NAV_TREE.find(v => v.id === 'news')!;
const MARKET = NAV_TREE.find(v => v.id === 'market')!;

function renderMenu(vertical = MARKET, pathname: string | null = '/') {
    const result = render(
        <HeaderNavMenu vertical={vertical} pathname={pathname} />
    );
    const trigger = screen.getByRole('button');
    // `aria-controls`가 가리키는 실제 패널. `getByRole('list')`는 2단 하위 목록까지
    // 잡아서 최상위 패널을 특정하지 못한다.
    const panelId = trigger.getAttribute('aria-controls')!;
    const panel = result.container.querySelector(`#${CSS.escape(panelId)}`)!;
    return { trigger, panel };
}

describe('HeaderNavMenu 트리거는', () => {
    it('클릭하면 열리고 다시 클릭하면 닫힌다', () => {
        const { trigger, panel } = renderMenu();

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(panel.className).toContain('invisible');

        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(panel.className).toContain('visible');
        expect(panel.className).not.toContain('invisible');

        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('마우스 포인터가 들어오면 열리고 나가면 닫힌다', () => {
        const { trigger } = renderMenu();
        const container = trigger.parentElement!;

        fireEvent.pointerEnter(container, { pointerType: 'mouse' });
        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        fireEvent.pointerLeave(container, { pointerType: 'mouse' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    /**
     * 터치에서 호버가 열면 뒤따르는 click 토글이 곧바로 닫아 메뉴가 절대 열리지
     * 않는다. `pointerType` 가드가 사라지면 이 테스트만 깨진다.
     */
    it('터치 포인터로는 호버 열림이 발생하지 않는다', () => {
        const { trigger } = renderMenu();
        const container = trigger.parentElement!;

        fireEvent.pointerEnter(container, { pointerType: 'touch' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('Escape로 닫고 포커스를 트리거로 돌려준다', () => {
        const { trigger } = renderMenu();

        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(document.activeElement).toBe(trigger);
    });

    it('바깥 pointerdown으로 닫힌다', () => {
        const { trigger } = renderMenu();

        fireEvent.click(trigger);
        fireEvent.pointerDown(document.body);

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('패널 안 링크를 누르면 닫힌다', () => {
        const { trigger, panel } = renderMenu();

        fireEvent.click(trigger);
        fireEvent.click(within(panel as HTMLElement).getAllByRole('link')[0]!);

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
});

describe('HeaderNavMenu 패널은', () => {
    it('닫혀 있어도 모든 지역·하위 링크를 DOM에 남긴다', () => {
        const { panel } = renderMenu(NEWS);

        const hrefs = within(panel as HTMLElement)
            .getAllByRole('link')
            .map(a => a.getAttribute('href'));

        for (const region of NEWS.regions) {
            expect(hrefs).toContain(region.href);
            for (const leaf of region.children) {
                expect(hrefs).toContain(leaf.href);
            }
        }
    });

    it('현재 경로와 정확히 일치하는 링크에만 aria-current를 붙인다', () => {
        // `/market`은 `/market/kr`의 접두사다 — prefix 매칭이면 둘 다 켜진다.
        const { panel } = renderMenu(MARKET, '/market/kr');

        const current = within(panel as HTMLElement)
            .getAllByRole('link')
            .filter(a => a.getAttribute('aria-current') === 'page')
            .map(a => a.getAttribute('href'));

        expect(current).toEqual(['/market/kr']);
    });
});
