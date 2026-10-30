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
import { NAV_TREE } from '../utils/headerNavTree';

const NEWS = NAV_TREE.find(v => v.id === 'news')!;
const MARKET = NAV_TREE.find(v => v.id === 'market')!;

function renderMenu(vertical = MARKET, pathname: string | null = '/') {
    const result = render(
        <HeaderNavMenu vertical={vertical} pathname={pathname} idScope="test" />
    );
    const trigger = screen.getByRole('button');
    // `aria-controls`가 가리키는 실제 패널. `getByRole('list')`는 2단 하위 목록까지
    // 잡아서 최상위 패널을 특정하지 못한다.
    const panelId = trigger.getAttribute('aria-controls')!;
    const panel = result.container.querySelector(`#${CSS.escape(panelId)}`)!;
    return { trigger, panel };
}

describe('HeaderNavMenu 트리거는', () => {
    /**
     * 영어 라벨(`Fear & Greed Index`처럼 공백이 있는 것)은 헤더 폭이 모자라면 트리거 안에서
     * 줄바꿈돼 `h-14` 행 밖으로 삐져나간다(`/en`, 2026-10-05 감사). 한글은 공백이 없어
     * 가려져 있던 문제다 — jsdom에는 레이아웃이 없어 클래스로 고정한다.
     */
    it('라벨이 줄바꿈되지 않는다', () => {
        const { trigger } = renderMenu();

        expect(trigger.className).toContain('whitespace-nowrap');
    });

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

    it('호버로 열린 메뉴를 클릭하면 닫히지 않고 열린 채 유지된다', () => {
        const { trigger } = renderMenu();
        const container = trigger.parentElement!;

        fireEvent.pointerEnter(container, { pointerType: 'mouse' });
        fireEvent.click(trigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('클릭으로 연 메뉴는 다시 클릭할 때만 닫힌다', () => {
        const { trigger } = renderMenu();
        const container = trigger.parentElement!;

        fireEvent.pointerEnter(container, { pointerType: 'mouse' });
        fireEvent.click(trigger);
        fireEvent.click(trigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('창 전환처럼 도착 요소가 없는 포커스 이탈은 닫지 않는다', () => {
        const { trigger } = renderMenu();

        fireEvent.click(trigger);
        fireEvent.focusOut(trigger, { relatedTarget: null });

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('포커스가 컨테이너 밖 요소로 옮겨가면 닫힌다', () => {
        const { trigger } = renderMenu();
        render(<button type="button">바깥</button>);
        const outside = screen.getByRole('button', { name: '바깥' });

        fireEvent.click(trigger);
        fireEvent.focusOut(trigger, { relatedTarget: outside });

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('포커스가 패널 안 링크로 이동하는 동안은 열린 채 유지된다', () => {
        const { trigger, panel } = renderMenu();

        fireEvent.click(trigger);
        fireEvent.focusOut(trigger, {
            relatedTarget: within(panel as HTMLElement).getAllByRole('link')[0],
        });

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('다른 메뉴의 트리거로 탭 이동하면 이전 패널이 닫힌다', () => {
        render(
            <>
                <HeaderNavMenu vertical={MARKET} pathname="/" idScope="a" />
                <HeaderNavMenu vertical={NEWS} pathname="/" idScope="b" />
            </>
        );
        const [first, second] = screen.getAllByRole('button');

        fireEvent.click(first!);
        fireEvent.focusOut(first!, { relatedTarget: second });

        expect(first).toHaveAttribute('aria-expanded', 'false');
    });

    describe('Escape는', () => {
        it('포커스가 메뉴 안에 있으면 닫고 포커스를 트리거로 돌려준다', () => {
            const { trigger, panel } = renderMenu();

            fireEvent.click(trigger);
            within(panel as HTMLElement)
                .getAllByRole('link')[0]!
                .focus();
            fireEvent.keyDown(document, { key: 'Escape' });

            expect(trigger).toHaveAttribute('aria-expanded', 'false');
            expect(trigger).toHaveFocus();
        });

        it('트리거에 포커스가 있어도 닫고 포커스를 유지한다', () => {
            const { trigger } = renderMenu();

            fireEvent.click(trigger);
            trigger.focus();
            fireEvent.keyDown(document, { key: 'Escape' });

            expect(trigger).toHaveAttribute('aria-expanded', 'false');
            expect(trigger).toHaveFocus();
        });

        it('호버로만 열린 메뉴라면 닫기만 하고 다른 곳의 포커스를 빼앗지 않는다', () => {
            const { trigger } = renderMenu();
            render(<input aria-label="검색" />);
            const input = screen.getByLabelText('검색');

            fireEvent.pointerEnter(trigger.parentElement!, {
                pointerType: 'mouse',
            });
            input.focus();
            fireEvent.keyDown(document, { key: 'Escape' });

            expect(trigger).toHaveAttribute('aria-expanded', 'false');
            expect(input).toHaveFocus();
        });
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
