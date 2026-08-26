import { TRENDLINE_DIRECTION_LABEL } from '@/shared/lib/trendline';

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
