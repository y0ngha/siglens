import { render, screen } from '@testing-library/react';

import { ConfidenceBar } from '../../../ui/skills-showcase/ConfidenceBar';
import { HIGH_CONFIDENCE_WEIGHT } from '../../../utils/confidenceTier';

function getBar(container: HTMLElement): HTMLElement {
    const bar = container.querySelector('[data-testid="confidence-bar"]');
    if (!bar) throw new Error('confidence-bar testid not found');
    return bar as HTMLElement;
}

describe('ConfidenceBar', () => {
    it.each([
        [0.2, 'bg-secondary-500'],
        [0.49, 'bg-secondary-500'],
        [0.5, 'bg-ui-warning'],
        [0.79, 'bg-ui-warning'],
        [HIGH_CONFIDENCE_WEIGHT, 'bg-chart-bullish'],
        [1.0, 'bg-chart-bullish'],
    ])('weight %f → %s', (weight, expected) => {
        const { container } = render(<ConfidenceBar weight={weight} />);

        expect(getBar(container).className).toContain(expected);
    });

    it('퍼센트 수치를 텍스트로 보여주고 막대는 장식으로 숨긴다', () => {
        const { container } = render(<ConfidenceBar weight={0.75} />);

        expect(screen.getByText('75%')).toBeInTheDocument();
        expect(getBar(container)).toHaveAttribute('aria-hidden', 'true');
    });

    it('막대 폭을 CSS 변수로 전달한다', () => {
        const { container } = render(<ConfidenceBar weight={0.6} />);

        expect(getBar(container).style.getPropertyValue('--confidence-w')).toBe(
            '60%'
        );
    });
});
