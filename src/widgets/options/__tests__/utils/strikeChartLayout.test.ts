import {
    CHART_HEIGHT,
    CHART_WIDTH,
    HALF_HEIGHT,
    MIDLINE_Y,
    PAD_LEFT,
    PAD_TOP,
    SVG_HEIGHT,
    SVG_WIDTH,
} from '@/widgets/options/utils/strikeChartLayout';

describe('strikeChartLayout', () => {
    it('derives the plot area from the SVG box minus padding', () => {
        expect([SVG_WIDTH, SVG_HEIGHT]).toEqual([600, 240]);
        expect(CHART_WIDTH).toBe(SVG_WIDTH - 2 * PAD_LEFT);
        expect(CHART_HEIGHT).toBe(160);
    });

    it('places the call/put midline at the vertical centre of the plot area', () => {
        expect(HALF_HEIGHT).toBe(CHART_HEIGHT / 2);
        expect(MIDLINE_Y).toBe(PAD_TOP + HALF_HEIGHT);
    });
});
