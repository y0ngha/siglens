// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponsiveRecordList } from '../../../ui/tables/ResponsiveRecordList';

function renderList(
    columns: readonly { label: string; align: 'left' | 'right' }[]
) {
    render(
        <ResponsiveRecordList
            caption="표 캡션"
            columns={columns}
            cards={<li>카드 하나</li>}
            rows={
                <tr>
                    <td>행 하나</td>
                </tr>
            }
        />
    );
}

describe('ResponsiveRecordList', () => {
    it('카드와 표 본문을 모두 렌더하고 캡션을 단다', () => {
        renderList([
            { label: '날짜', align: 'left' },
            { label: '금액', align: 'right' },
        ]);
        expect(screen.getByText('카드 하나')).toBeInTheDocument();
        expect(screen.getByText('행 하나')).toBeInTheDocument();
        expect(screen.getByText('표 캡션')).toHaveClass('sr-only');
    });

    it('머리글 글자 정렬은 열의 align을 따른다', () => {
        renderList([
            { label: '날짜', align: 'left' },
            { label: '금액', align: 'right' },
        ]);
        expect(screen.getByText('날짜')).toHaveClass('text-left');
        expect(screen.getByText('금액')).toHaveClass('text-right');
    });

    it('두 칸이면 첫 칸은 오른쪽, 끝 칸은 왼쪽 여백만 준다', () => {
        renderList([
            { label: '날짜', align: 'left' },
            { label: '금액', align: 'right' },
        ]);
        expect(screen.getByText('날짜')).toHaveClass('py-2', 'pr-3');
        expect(screen.getByText('금액')).toHaveClass('py-2', 'pl-3');
    });

    it('칸이 하나면 첫 칸 규칙이 이긴다(끝 칸 여백이 겹치지 않는다)', () => {
        renderList([{ label: '날짜', align: 'left' }]);
        const th = screen.getByText('날짜');
        expect(th).toHaveClass('py-2', 'pr-3');
        expect(th).not.toHaveClass('pl-3');
    });

    it('가운데 칸은 좌우 여백을 준다', () => {
        renderList([
            { label: 'A', align: 'left' },
            { label: 'B', align: 'left' },
            { label: 'C', align: 'right' },
        ]);
        expect(screen.getByText('B')).toHaveClass('px-3', 'py-2');
    });
});
