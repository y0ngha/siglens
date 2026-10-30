import { render, screen } from '@testing-library/react';
import { ScoreBar } from '@/widgets/financials/ui/axis-card/ScoreBar';

describe('ScoreBar', () => {
    it('점수 막대를 이름과 0–100 범위를 가진 progressbar로 노출한다', () => {
        render(<ScoreBar score={72} grade="B" />);

        const bar = screen.getByRole('progressbar', { name: '점수' });
        expect(bar).toHaveAttribute('aria-valuenow', '72');
        expect(bar).toHaveAttribute('aria-valuemin', '0');
        expect(bar).toHaveAttribute('aria-valuemax', '100');
    });
});
