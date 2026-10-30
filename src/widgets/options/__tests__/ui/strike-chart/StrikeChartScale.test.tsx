import { render } from '@testing-library/react';
import { StrikeChartScale } from '@/widgets/options/ui/strike-chart/StrikeChartScale';

describe('StrikeChartScale', () => {
    it('draws the midline and the peak, call and put labels', () => {
        const { container } = render(
            <svg>
                <StrikeChartScale
                    peakLabel="1.5k"
                    callLabel="▲ Call"
                    putLabel="▼ Put"
                />
            </svg>
        );
        expect(container.querySelectorAll('line')).toHaveLength(1);
        expect(
            [...container.querySelectorAll('text')].map(t => t.textContent)
        ).toEqual(['1.5k', '▲ Call', '▼ Put']);
    });
});
