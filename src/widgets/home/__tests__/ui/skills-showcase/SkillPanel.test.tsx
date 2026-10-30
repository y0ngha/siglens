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
import type { SkillShowcaseItem } from '@y0ngha/siglens-core';

import { SkillPanel } from '../../../ui/skills-showcase/SkillPanel';
import { INITIAL_VISIBLE_COUNT } from '../../../utils/skillTabs';

function makeSkill(
    name: string,
    type: SkillShowcaseItem['type']
): SkillShowcaseItem {
    return { name, type, description: `${name} d`, confidenceWeight: 0.9 };
}

const SKILLS = [
    makeSkill('p1', 'pattern'),
    makeSkill('p2', 'pattern'),
    makeSkill('s1', 'strategy'),
];

function renderPanel(
    overrides: Partial<React.ComponentProps<typeof SkillPanel>> = {}
) {
    return render(
        <SkillPanel
            tab="pattern"
            isActive
            idPrefix="x"
            skills={SKILLS}
            showAll={false}
            expandedKey={null}
            onToggleShowAll={vi.fn()}
            onToggleExpand={vi.fn()}
            {...overrides}
        />
    );
}

describe('SkillPanel', () => {
    it('활성 패널은 자기 탭 타입의 카드만 그린다', () => {
        renderPanel();

        expect(screen.getByText('p1')).toBeInTheDocument();
        expect(screen.getByText('p2')).toBeInTheDocument();
        expect(screen.queryByText('s1')).not.toBeInTheDocument();
    });

    it('비활성 패널도 hidden으로 남되 카드는 DOM에 렌더한다(서버 HTML 유지)', () => {
        renderPanel({ isActive: false });

        const panel = screen.getByRole('tabpanel', { hidden: true });
        expect(panel).toHaveAttribute('hidden');
        expect(within(panel).getByText('p1')).toBeInTheDocument();
        expect(within(panel).getByText('p2')).toBeInTheDocument();
    });

    it('tabpanel id와 aria-labelledby가 탭 id 규칙을 따른다', () => {
        renderPanel();

        const panel = screen.getByRole('tabpanel');
        expect(panel.id).toContain('x');
        expect(panel.getAttribute('aria-labelledby')).toContain('x');
    });

    it('초기 노출 수를 넘으면 남은 개수가 든 더 보기 버튼을 보인다', () => {
        const many = Array.from({ length: INITIAL_VISIBLE_COUNT + 2 }, (_, i) =>
            makeSkill(`k${i}`, 'pattern')
        );
        renderPanel({ skills: many });

        expect(
            screen.getByRole('button', { name: '더 보기 (2개)' })
        ).toBeInTheDocument();
        expect(screen.queryByText(`k${INITIAL_VISIBLE_COUNT}`)).toBeNull();
    });

    it('showAll이면 전부 그리고 접기 버튼이 onToggleShowAll을 부른다', async () => {
        const onToggleShowAll = vi.fn();
        const user = userEvent.setup();
        const many = Array.from({ length: INITIAL_VISIBLE_COUNT + 2 }, (_, i) =>
            makeSkill(`k${i}`, 'pattern')
        );
        renderPanel({ skills: many, showAll: true, onToggleShowAll });

        expect(
            screen.getByText(`k${INITIAL_VISIBLE_COUNT + 1}`)
        ).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '접기' }));
        expect(onToggleShowAll).toHaveBeenCalledTimes(1);
    });

    it('비활성 패널도 초기 노출 수 슬라이스와 더 보기 버튼을 그대로 렌더한다', () => {
        const many = Array.from({ length: INITIAL_VISIBLE_COUNT + 2 }, (_, i) =>
            makeSkill(`k${i}`, 'pattern')
        );
        renderPanel({ skills: many, isActive: false });

        expect(screen.getByText('k0')).toBeInTheDocument();
        expect(screen.queryByText(`k${INITIAL_VISIBLE_COUNT}`)).toBeNull();
        expect(
            screen.getByRole('button', { name: '더 보기 (2개)', hidden: true })
        ).toBeInTheDocument();
    });
});
