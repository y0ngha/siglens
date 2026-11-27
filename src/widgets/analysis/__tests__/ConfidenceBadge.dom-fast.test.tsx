import { fireEvent, render, screen } from '@testing-library/react';
import { HIGH_CONFIDENCE_WEIGHT } from '@y0ngha/siglens-core';
import { ConfidenceBadge } from '@/widgets/analysis/ui/ConfidenceBadge';

describe('ConfidenceBadge', () => {
    it.each([
        [HIGH_CONFIDENCE_WEIGHT, '높은 신뢰도'],
        [HIGH_CONFIDENCE_WEIGHT - 0.01, '중간 신뢰도'],
    ])('weight %s shows "%s"', (confidenceWeight, label) => {
        render(<ConfidenceBadge confidenceWeight={confidenceWeight} />);
        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('explains the badge as a preset strategy score, not AI detection clarity', () => {
        render(<ConfidenceBadge confidenceWeight={HIGH_CONFIDENCE_WEIGHT} />);
        fireEvent.click(screen.getByRole('button', { name: '추가 정보' }));
        expect(
            screen.getByText('이 전략에 미리 매겨 둔 점수가 높다는 뜻이에요.')
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'AI가 분명하게 감지했다는 뜻도, 실제로 잘 맞는다는 뜻도 아니에요.'
            )
        ).toBeInTheDocument();
        expect(screen.queryByText(/패턴/)).not.toBeInTheDocument();
    });

    it('describes the medium badge as a medium preset score', () => {
        render(<ConfidenceBadge confidenceWeight={0.5} />);
        fireEvent.click(screen.getByRole('button', { name: '추가 정보' }));
        expect(
            screen.getByText(
                '이 전략에 미리 매겨 둔 점수가 중간이라는 뜻이에요.'
            )
        ).toBeInTheDocument();
    });
});
