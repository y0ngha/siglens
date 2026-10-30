import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SkillTabs } from '../../../ui/skills-showcase/SkillTabs';

describe('SkillTabs', () => {
    it('"전체" + 모든 스킬 타입 탭을 번역된 라벨로 렌더한다', () => {
        render(<SkillTabs activeTab="all" onChange={vi.fn()} idPrefix="t" />);

        expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
            '전체',
            '보조지표',
            '차트 패턴',
            '전략',
            '캔들 패턴',
            '지지/저항',
        ]);
    });

    it('활성 탭만 aria-selected=true다', () => {
        render(
            <SkillTabs activeTab="strategy" onChange={vi.fn()} idPrefix="t" />
        );

        expect(screen.getByRole('tab', { name: '전략' })).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(screen.getByRole('tab', { name: '전체' })).toHaveAttribute(
            'aria-selected',
            'false'
        );
    });

    it('탭을 누르면 해당 값으로 onChange를 호출한다', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<SkillTabs activeTab="all" onChange={onChange} idPrefix="t" />);

        await user.click(screen.getByRole('tab', { name: '차트 패턴' }));

        expect(onChange).toHaveBeenCalledWith('pattern');
    });
});
