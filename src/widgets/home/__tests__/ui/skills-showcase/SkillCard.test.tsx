// useIsClamped(useEffect + ResizeObserver)가 SkillCard에서 호출되므로
// 파일 전역으로 ResizeObserver를 stub해 ReferenceError를 방지한다.
vi.stubGlobal(
    'ResizeObserver',
    class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
    }
);

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SkillShowcaseItem } from '@y0ngha/siglens-core';

import { SkillCard } from '../../../ui/skills-showcase/SkillCard';

function makeSkill(
    name: string,
    type: SkillShowcaseItem['type'] = 'indicator_guide',
    confidenceWeight = 0.85
): SkillShowcaseItem {
    return {
        name,
        type,
        description: `${name} description`,
        confidenceWeight,
    };
}

describe('SkillCard', () => {
    const ORIGINAL = Object.getOwnPropertyDescriptors(HTMLElement.prototype);

    function stubClamp(clamped: boolean): void {
        // 접힘 상태에서 scrollHeight > clientHeight 이면 "펼침 가능"으로 판정됨.
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
            configurable: true,
            get: () => (clamped ? 80 : 40),
        });
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
            configurable: true,
            get: () => 40,
        });
    }

    afterAll(() => {
        vi.unstubAllGlobals();
        Object.defineProperties(HTMLElement.prototype, ORIGINAL);
    });

    it('is interactive (role=button, aria-expanded) when the description is clamped', () => {
        stubClamp(true);
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={vi.fn()}
            />
        );

        const card = screen.getByRole('button', { name: /RSI/ });
        expect(card).toHaveAttribute('aria-expanded', 'false');
    });

    it('is NOT interactive when the description fits (not clamped)', () => {
        stubClamp(false);
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={vi.fn()}
            />
        );

        expect(screen.queryByRole('button', { name: /RSI/ })).toBeNull();
    });

    it('reflects aria-expanded=true when expanded', () => {
        stubClamp(true);
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={true}
                onToggleExpand={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: /RSI/ })).toHaveAttribute(
            'aria-expanded',
            'true'
        );
    });

    it('stays interactive when already expanded even if the description no longer overflows', () => {
        // canExpand = isClamped || isExpanded — an expanded card must remain a
        // toggle target so the user can still collapse it, even though the
        // clamp check (measured for the collapsed state) reports false here.
        stubClamp(false);
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={true}
                onToggleExpand={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: /RSI/ })).toHaveAttribute(
            'aria-expanded',
            'true'
        );
    });

    it('calls onToggleExpand with the skill name on click', async () => {
        stubClamp(true);
        const onToggle = vi.fn();
        const user = userEvent.setup();
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={onToggle}
            />
        );

        await user.click(screen.getByRole('button', { name: /RSI/ }));

        expect(onToggle).toHaveBeenCalledWith('RSI');
    });

    it('toggles on Enter when the card itself is focused', async () => {
        stubClamp(true);
        const onToggle = vi.fn();
        const user = userEvent.setup();
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={onToggle}
            />
        );

        const card = screen.getByRole('button', { name: /RSI/ });
        card.focus();
        await user.keyboard('{Enter}');

        expect(onToggle).toHaveBeenCalledWith('RSI');
    });

    it('toggles on Space when the card itself is focused', async () => {
        stubClamp(true);
        const onToggle = vi.fn();
        const user = userEvent.setup();
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={onToggle}
            />
        );

        const card = screen.getByRole('button', { name: /RSI/ });
        card.focus();
        await user.keyboard(' ');

        expect(onToggle).toHaveBeenCalledWith('RSI');
    });

    it('가이드가 있는 스킬 카드는 가이드 링크를 카드의 버튼 영역 밖에 둔다', () => {
        stubClamp(true);
        render(
            <SkillCard
                skill={makeSkill('Doji Pattern Guide', 'candlestick')}
                isExpanded={false}
                onToggleExpand={vi.fn()}
            />
        );

        const link = screen.getByRole('link', { name: /가이드 보기/ });
        expect(link).toHaveAttribute('href', '/guide/candlesticks/doji');
        expect(link.closest('[role="button"]')).toBeNull();
    });

    it('가이드가 없는 스킬 카드는 링크를 그리지 않는다', () => {
        render(
            <SkillCard
                skill={makeSkill('가이드 없는 스킬')}
                isExpanded={false}
                onToggleExpand={vi.fn()}
            />
        );

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('스킬 타입에 맞는 배지 라벨을 그린다', () => {
        render(
            <SkillCard
                skill={makeSkill('Doji Pattern Guide', 'candlestick')}
                isExpanded={false}
                onToggleExpand={vi.fn()}
            />
        );

        expect(screen.getByText('캔들')).toBeInTheDocument();
    });

    it('신뢰도 점수를 퍼센트로 보여준다', () => {
        render(
            <SkillCard
                skill={makeSkill('RSI', 'indicator_guide', 0.75)}
                isExpanded={false}
                onToggleExpand={vi.fn()}
            />
        );

        expect(screen.getByText('75%')).toBeInTheDocument();
    });
});
