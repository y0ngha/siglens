import {
    DEFAULT_LINE_WIDTH,
    INACTIVE_PANE_INDEX,
    FIRST_INDICATOR_PANE_INDEX,
    LABEL_SERIES_INDEX,
    REGION_LOWER_PRICE_INDEX,
    REGION_UPPER_PRICE_INDEX,
    REGION_KEY_PRICE_MIN_LENGTH,
    MARKER_POSITION,
    MARKER_SHAPE,
    BASE_PATTERN_SERIES_OPTIONS,
} from '@/widgets/chart/constants';

describe('chart constants', () => {
    it('DEFAULT_LINE_WIDTH is 1', () => {
        expect(DEFAULT_LINE_WIDTH).toBe(1);
    });

    it('INACTIVE_PANE_INDEX is -1', () => {
        expect(INACTIVE_PANE_INDEX).toBe(-1);
    });

    it('FIRST_INDICATOR_PANE_INDEX is 1', () => {
        expect(FIRST_INDICATOR_PANE_INDEX).toBe(1);
    });

    it('LABEL_SERIES_INDEX is 0', () => {
        expect(LABEL_SERIES_INDEX).toBe(0);
    });

    it('REGION_LOWER_PRICE_INDEX is 0', () => {
        expect(REGION_LOWER_PRICE_INDEX).toBe(0);
    });

    it('REGION_UPPER_PRICE_INDEX is 1', () => {
        expect(REGION_UPPER_PRICE_INDEX).toBe(1);
    });

    it('REGION_KEY_PRICE_MIN_LENGTH equals REGION_UPPER_PRICE_INDEX + 1', () => {
        expect(REGION_KEY_PRICE_MIN_LENGTH).toBe(REGION_UPPER_PRICE_INDEX + 1);
    });

    it('MARKER_POSITION is "aboveBar"', () => {
        expect(MARKER_POSITION).toBe('aboveBar');
    });

    it('MARKER_SHAPE is "arrowDown"', () => {
        expect(MARKER_SHAPE).toBe('arrowDown');
    });

    describe('BASE_PATTERN_SERIES_OPTIONS', () => {
        it('uses DEFAULT_LINE_WIDTH for lineWidth', () => {
            expect(BASE_PATTERN_SERIES_OPTIONS.lineWidth).toBe(
                DEFAULT_LINE_WIDTH
            );
        });

        it('hides price line', () => {
            expect(BASE_PATTERN_SERIES_OPTIONS.priceLineVisible).toBe(false);
        });

        it('hides last value', () => {
            expect(BASE_PATTERN_SERIES_OPTIONS.lastValueVisible).toBe(false);
        });

        it('has exactly three properties', () => {
            expect(Object.keys(BASE_PATTERN_SERIES_OPTIONS)).toHaveLength(3);
        });
    });
});
