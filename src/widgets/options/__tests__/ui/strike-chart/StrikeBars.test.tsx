import { fireEvent, render } from '@testing-library/react';
import {
    StrikeBars,
    type StrikeBarDatum,
} from '@/widgets/options/ui/strike-chart/StrikeBars';

const BARS: StrikeBarDatum[] = [
    { strike: 100, call: 10, put: 0, opacity: 0.85 },
    { strike: 110, call: 0, put: 20, opacity: 1 },
];

function setup(bars = BARS) {
    const handlers = {
        onPointerEnter: vi.fn(),
        onPointerMove: vi.fn(),
        onPointerLeave: vi.fn(),
    };
    const { container } = render(
        <svg>
            <StrikeBars
                bars={bars}
                globalMax={20}
                tooltipId="tip"
                {...handlers}
            />
        </svg>
    );
    return { container, ...handlers };
}

describe('StrikeBars', () => {
    it('draws a call bar only for a positive call value and a put bar only for a positive put value', () => {
        const { container } = setup();
        // 2 hit rects + 1 call bar + 1 put bar
        expect(container.querySelectorAll('rect')).toHaveLength(4);
    });

    it('applies each bar opacity', () => {
        const { container } = setup();
        const opacities = [...container.querySelectorAll('rect[opacity]')].map(
            r => r.getAttribute('opacity')
        );
        expect(opacities).toEqual(['0.85', '1']);
    });

    it('gives each hit rect the tooltip id', () => {
        const { container } = setup();
        expect(
            container.querySelectorAll('rect[aria-describedby="tip"]')
        ).toHaveLength(2);
    });

    it('forwards pointer events with the strike index', () => {
        const { container, onPointerEnter, onPointerMove, onPointerLeave } =
            setup();
        const hit = container.querySelectorAll(
            'rect[aria-describedby="tip"]'
        )[1]!;
        fireEvent.pointerEnter(hit);
        fireEvent.pointerMove(hit);
        fireEvent.pointerLeave(hit);
        expect(onPointerEnter).toHaveBeenCalledWith(expect.anything(), 1);
        expect(onPointerMove).toHaveBeenCalledWith(expect.anything(), 1);
        expect(onPointerLeave).toHaveBeenCalledTimes(1);
    });
});
