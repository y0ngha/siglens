import {
    calculateMA,
    EMPTY_INDICATOR_RESULT,
    MA_DEFAULT_PERIODS,
} from '@y0ngha/siglens-core';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import {
    CHART_MA_PERIODS,
    withChartMaPeriods,
} from '@/widgets/chart/utils/chartMaPeriods';

const bars: Bar[] = Array.from({ length: 80 }, (_, i) => ({
    time: 1_000 + i * 60,
    open: 100 + i,
    high: 102 + i,
    low: 99 + i,
    close: 100 + i * 0.5 + (i % 3),
    volume: 1_000,
}));

describe('CHART_MA_PERIODS', () => {
    it('core 기본 기간에 50을 더한 오름차순 목록이다', () => {
        expect(CHART_MA_PERIODS).toEqual([5, 20, 50, 60, 120, 200]);
    });

    it('core 기본 기간을 모두 그대로 포함한다', () => {
        for (const period of MA_DEFAULT_PERIODS) {
            expect(CHART_MA_PERIODS).toContain(period);
        }
    });
});

describe('withChartMaPeriods', () => {
    it('core 결과에 없는 50일선을 calculateMA(bars, 50)과 같은 값으로 채운다', () => {
        const result = withChartMaPeriods(EMPTY_INDICATOR_RESULT, bars);

        expect(result.ma[50]).toEqual(calculateMA(bars, 50));
        expect(result.ma[50]).toHaveLength(bars.length);
        expect(result.ma[50]?.[49]).not.toBeNull();
    });

    it('core가 이미 계산한 기간은 건드리지 않는다', () => {
        const core: IndicatorResult = {
            ...EMPTY_INDICATOR_RESULT,
            ma: { 5: [1, 2, 3], 50: [9, 9, 9] },
        };
        const result = withChartMaPeriods(core, bars);

        expect(result.ma[5]).toEqual([1, 2, 3]);
        expect(result.ma[50]).toEqual([9, 9, 9]);
    });

    it('채울 기간이 없으면 같은 참조를 돌려준다', () => {
        const full: IndicatorResult = {
            ...EMPTY_INDICATOR_RESULT,
            ma: Object.fromEntries(CHART_MA_PERIODS.map(p => [p, []])),
        };

        expect(withChartMaPeriods(full, bars)).toBe(full);
    });

    it('입력 결과를 바꾸지 않는다', () => {
        const core: IndicatorResult = { ...EMPTY_INDICATOR_RESULT, ma: {} };
        withChartMaPeriods(core, bars);

        expect(core.ma).toEqual({});
    });
});
