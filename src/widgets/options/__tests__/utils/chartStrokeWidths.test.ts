import {
    MIDLINE_STROKE_WIDTH,
    GUIDE_LINE_STROKE_WIDTH,
} from '@/widgets/options/utils/chartStrokeWidths';

describe('chartStrokeWidths', () => {
    it('MIDLINE_STROKE_WIDTH is a positive number', () => {
        expect(MIDLINE_STROKE_WIDTH).toBeGreaterThan(0);
    });

    it('GUIDE_LINE_STROKE_WIDTH is a positive number', () => {
        expect(GUIDE_LINE_STROKE_WIDTH).toBeGreaterThan(0);
    });

    it('guide line is thicker than midline', () => {
        expect(GUIDE_LINE_STROKE_WIDTH).toBeGreaterThanOrEqual(
            MIDLINE_STROKE_WIDTH
        );
    });
});
