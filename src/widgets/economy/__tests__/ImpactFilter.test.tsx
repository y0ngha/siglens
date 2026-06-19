import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CalendarImpact } from '@y0ngha/siglens-core';

import { ImpactFilter } from '@/widgets/economy/sections/ImpactFilter';

const ALL_ON = new Set<CalendarImpact>(['High', 'Medium', 'Low']);
const DEFAULT = new Set<CalendarImpact>(['High', 'Medium']);

describe('ImpactFilter', () => {
    it('High/Medium/Low 칩 3개를 버튼으로 렌더한다', () => {
        render(<ImpactFilter value={ALL_ON} onToggle={vi.fn()} />);
        expect(
            screen.getByRole('button', { name: '높음' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '보통' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '낮음' })
        ).toBeInTheDocument();
    });

    it('"중요도 필터" 레이블의 group role로 감싼다', () => {
        render(<ImpactFilter value={ALL_ON} onToggle={vi.fn()} />);
        expect(
            screen.getByRole('group', { name: '중요도 필터' })
        ).toBeInTheDocument();
    });

    it('활성 impact 칩만 aria-pressed=true 다', () => {
        render(<ImpactFilter value={DEFAULT} onToggle={vi.fn()} />);
        expect(screen.getByRole('button', { name: '높음' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        expect(screen.getByRole('button', { name: '보통' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        expect(screen.getByRole('button', { name: '낮음' })).toHaveAttribute(
            'aria-pressed',
            'false'
        );
    });

    it('칩 클릭 시 해당 impact로 onToggle을 호출한다', () => {
        const onToggle = vi.fn();
        render(<ImpactFilter value={DEFAULT} onToggle={onToggle} />);
        fireEvent.click(screen.getByRole('button', { name: '낮음' }));
        expect(onToggle).toHaveBeenCalledWith('Low');
    });

    it('각 칩 버튼은 type=button 이다 (form submit 방지)', () => {
        render(<ImpactFilter value={ALL_ON} onToggle={vi.fn()} />);
        for (const name of ['높음', '보통', '낮음']) {
            expect(screen.getByRole('button', { name })).toHaveAttribute(
                'type',
                'button'
            );
        }
    });
});
