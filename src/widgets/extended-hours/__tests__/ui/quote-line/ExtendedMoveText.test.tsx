import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExtendedMoveText } from '@/widgets/extended-hours/ui/quote-line/ExtendedMoveText';
import { describeExtendedMove } from '@/widgets/extended-hours/utils/extendedMove';

describe('ExtendedMoveText', () => {
    it('상승: 장식 화살표·sr-only 단어·금액·%를 방향색으로 그린다', () => {
        render(
            <ExtendedMoveText
                move={describeExtendedMove(3.42, 0.9972)}
                moveLabel="상승"
            />
        );

        const move = screen.getByTestId('extended-hours-move');
        expect(move).toHaveTextContent('▲상승+$3.42 +1.00%');
        expect(move).toHaveClass('text-ui-success-text');
        expect(screen.getByText('▲')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText('상승')).toHaveClass('sr-only');
    });

    it('sm 미만에서는 금액을 숨기고 %만 남긴다', () => {
        render(
            <ExtendedMoveText
                move={describeExtendedMove(-1.75, -0.5)}
                moveLabel="하락"
            />
        );

        expect(screen.getByText('-$1.75')).toHaveClass('hidden', 'sm:inline');
    });

    it('보합: 화살표와 방향색 없이 단어·값만 그린다', () => {
        render(
            <ExtendedMoveText
                move={describeExtendedMove(0, 0)}
                moveLabel="보합"
            />
        );

        const move = screen.getByTestId('extended-hours-move');
        expect(move).toHaveTextContent('보합$0.00 0.00%');
        expect(move).not.toHaveAttribute('class');
        expect(move.querySelector('[aria-hidden="true"]')).toBeNull();
    });
});
