import { render } from '@testing-library/react';
import { StrikeGuideLines } from '@/widgets/options/ui/strike-chart/StrikeGuideLines';

function renderLines(props: Parameters<typeof StrikeGuideLines>[0]) {
    return render(
        <svg>
            <StrikeGuideLines {...props} />
        </svg>
    ).container.querySelectorAll('line');
}

describe('StrikeGuideLines', () => {
    it('draws a solid current-price line', () => {
        const lines = renderLines({ count: 5, currentPriceIdx: 2 });
        expect(lines).toHaveLength(1);
        expect(lines[0]).not.toHaveAttribute('stroke-dasharray');
    });

    it('adds a dashed Max Pain line when an index is given', () => {
        const lines = renderLines({
            count: 5,
            currentPriceIdx: 2,
            maxPainIdx: 3,
        });
        expect(lines).toHaveLength(2);
        expect(lines[0]).toHaveAttribute('stroke-dasharray', '4 4');
    });

    it('omits the Max Pain line for a negative index', () => {
        expect(
            renderLines({ count: 5, currentPriceIdx: 2, maxPainIdx: -1 })
        ).toHaveLength(1);
    });

    it('omits the current-price line for a negative index', () => {
        expect(renderLines({ count: 5, currentPriceIdx: -1 })).toHaveLength(0);
    });

    it('places the line at different x for different indices', () => {
        const [a] = renderLines({ count: 5, currentPriceIdx: 0 });
        const [b] = renderLines({ count: 5, currentPriceIdx: 4 });
        expect(Number(a?.getAttribute('x1'))).toBeLessThan(
            Number(b?.getAttribute('x1'))
        );
    });
});
