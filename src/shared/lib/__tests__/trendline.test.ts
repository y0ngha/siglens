import {
    TRENDLINE_DIRECTION_LABEL,
    TRENDLINE_DIRECTION_COLOR,
} from '@/shared/lib/trendline';
import { CHART_COLORS } from '@/shared/lib/chartColors';

describe('TRENDLINE_DIRECTION_LABEL', () => {
    it('maps ascending to Korean ascending label', () => {
        expect(TRENDLINE_DIRECTION_LABEL.ascending).toBe('상승 추세선');
    });

    it('maps descending to Korean descending label', () => {
        expect(TRENDLINE_DIRECTION_LABEL.descending).toBe('하락 추세선');
    });

    it('has exactly two entries', () => {
        expect(Object.keys(TRENDLINE_DIRECTION_LABEL)).toHaveLength(2);
    });
});

describe('TRENDLINE_DIRECTION_COLOR', () => {
    it('maps ascending to CHART_COLORS.trendlineAscending', () => {
        expect(TRENDLINE_DIRECTION_COLOR.ascending).toBe(
            CHART_COLORS.trendlineAscending
        );
    });

    it('maps descending to CHART_COLORS.trendlineDescending', () => {
        expect(TRENDLINE_DIRECTION_COLOR.descending).toBe(
            CHART_COLORS.trendlineDescending
        );
    });

    it('has exactly two entries', () => {
        expect(Object.keys(TRENDLINE_DIRECTION_COLOR)).toHaveLength(2);
    });
});
