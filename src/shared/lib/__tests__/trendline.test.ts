import {
    TRENDLINE_DIRECTION_LABEL,
    trendlineDirectionColor,
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

describe('trendlineDirectionColor', () => {
    it('maps ascending to CHART_COLORS.trendlineAscending', () => {
        expect(trendlineDirectionColor('ascending')).toBe(
            CHART_COLORS.trendlineAscending
        );
    });

    it('maps descending to CHART_COLORS.trendlineDescending', () => {
        expect(trendlineDirectionColor('descending')).toBe(
            CHART_COLORS.trendlineDescending
        );
    });

    /*
     * 테마별 값이 실제로 갈리는지는 `chartChrome.test.tsx`가 본다 —
     * 이 파일은 node 환경이라 `document`가 없어 항상 다크로 떨어진다.
     */
});
