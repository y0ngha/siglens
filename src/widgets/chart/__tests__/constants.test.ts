import {
    DEFAULT_LINE_WIDTH,
    INACTIVE_PANE_INDEX,
    FIRST_INDICATOR_PANE_INDEX,
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
});
