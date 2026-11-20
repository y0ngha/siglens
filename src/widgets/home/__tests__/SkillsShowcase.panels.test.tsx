vi.stubGlobal(
    'ResizeObserver',
    class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
    }
);

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HomeSkillItem } from '../utils/toSkillShowcaseItems';

import { SkillsShowcase } from '../SkillsShowcase';

function makeSkills(
    type: NonNullable<HomeSkillItem['type']>,
    count: number
): HomeSkillItem[] {
    return Array.from({ length: count }, (_, i) => ({
        name: `${type}-${i}`,
        type,
        description: `${type}-${i} description`,
    }));
}

/** 실제 훅·TabsPill로 탭 전환을 끝까지 태운다(다른 파일은 훅을 mock한다). */
describe('SkillsShowcase 탭 패널 마운트', () => {
    const SKILLS = [...makeSkills('pattern', 5), ...makeSkills('strategy', 4)];

    /** 패널 안의 스킬 카드 수 — 카드마다 `<type>-<i> description` 요약이 하나씩 있다. */
    function cardsIn(panel: HTMLElement): number {
        return within(panel).queryAllByText(/ description$/).length;
    }

    it('기본 탭(전체)은 SSR 첫 렌더부터 스킬 카드를 그린다', () => {
        render(<SkillsShowcase skills={SKILLS} />);

        const [allPanel] = screen.getAllByRole('tabpanel', { hidden: true });
        expect(cardsIn(allPanel!)).toBe(SKILLS.length);
        expect(within(allPanel!).getByText('pattern-0')).toBeInTheDocument();
    });

    it('숨은 패널도 자기 타입의 카드를 DOM에 유지한다(서버 HTML에 모든 탭 스킬)', async () => {
        const user = userEvent.setup();
        render(<SkillsShowcase skills={SKILLS} />);

        await user.click(screen.getByRole('tab', { name: '전략' }));

        const panels = screen.getAllByRole('tabpanel', { hidden: true });
        expect(panels).toHaveLength(6);
        expect(panels.map(cardsIn)).toEqual([9, 0, 5, 4, 0, 0]);
        expect(
            panels.filter(panel => !panel.hasAttribute('hidden'))
        ).toHaveLength(1);
    });

    it('스킬이 없는 타입 탭도 tabpanel은 남는다', async () => {
        const user = userEvent.setup();
        render(<SkillsShowcase skills={SKILLS} />);

        await user.click(screen.getByRole('tab', { name: '캔들 패턴' }));

        expect(cardsIn(screen.getByRole('tabpanel'))).toBe(0);
    });
});
