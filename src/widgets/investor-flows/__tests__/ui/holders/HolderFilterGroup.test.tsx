// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HolderFilterGroup } from '../../../ui/holders/HolderFilterGroup';

const COUNTS = { all: 10, new: 3, exited: 2 };

describe('HolderFilterGroup', () => {
    it('필터마다 건수를 붙인 버튼을 전체·신규·청산 순서로 보인다', () => {
        render(
            <HolderFilterGroup value="all" counts={COUNTS} onChange={vi.fn()} />
        );
        expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual([
            '전체 10',
            '신규 진입 3',
            '완전 청산 2',
        ]);
    });

    it('선택된 필터만 눌린 상태이고 그룹은 이름을 가진다', () => {
        render(
            <HolderFilterGroup value="new" counts={COUNTS} onChange={vi.fn()} />
        );
        expect(
            screen.getByRole('button', { name: '신규 진입 3' })
        ).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: '전체 10' })).toHaveAttribute(
            'aria-pressed',
            'false'
        );
        expect(
            screen.getByRole('group', { name: '보기 필터' })
        ).toBeInTheDocument();
    });

    it('버튼을 누르면 그 필터로 onChange를 부른다', async () => {
        const onChange = vi.fn();
        render(
            <HolderFilterGroup
                value="all"
                counts={COUNTS}
                onChange={onChange}
            />
        );
        await userEvent.click(
            screen.getByRole('button', { name: '완전 청산 2' })
        );
        expect(onChange).toHaveBeenCalledWith('exited');
    });
});
