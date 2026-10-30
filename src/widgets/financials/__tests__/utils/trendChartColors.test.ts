import { describe, expect, it } from 'vitest';
import { seriesColorClasses } from '@/widgets/financials/utils/trendChartColors';

describe('seriesColorClasses', () => {
    it('선언한 색의 클래스를 돌려준다', () => {
        expect(seriesColorClasses('bullish').fill).toBe(
            'fill-chart-bullish/85'
        );
        expect(seriesColorClasses('bearish').legend).toBe('bg-chart-bearish');
    });

    it('생략하면 neutral이다', () => {
        expect(seriesColorClasses(undefined)).toEqual(
            seriesColorClasses('neutral')
        );
        expect(seriesColorClasses('neutral').dot).toBe('bg-primary-500');
    });

    it('막대·범례·툴팁 점이 같은 색 계열을 가리킨다', () => {
        const neutral = seriesColorClasses('neutral');
        expect(neutral.fill).toContain('primary-500');
        expect(neutral.legend).toContain('primary-500');
        expect(neutral.dot).toContain('primary-500');
    });
});
