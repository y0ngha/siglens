import {
    EMPTY_INDICATOR_RESULT,
    MA_DEFAULT_PERIODS,
    calculateMA,
    type Bar,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import {
    CHART_MA_PERIODS,
    CHART_ONLY_MA_PERIODS,
} from '@/widgets/chart/constants';
import { withChartOnlyMaPeriods } from '@/widgets/chart/utils/chartMaPeriods';

function barsWithCloses(closes: readonly number[]): Bar[] {
    return closes.map((close, index) => ({
        time: 1_700_000_000 + index * 86_400,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1000,
    }));
}

describe('CHART_MA_PERIODS', () => {
    /**
     * 리터럴로 둔 이유는 constants.ts JSDoc에 있다. 그 대가로 core 기본 기간이 바뀌면
     * 여기서 깨져야 한다 — 그러지 않으면 core가 낸 기간이 메뉴에서 빠지거나, core가 내지
     * 않는 기간이 메뉴에 남아 빈 선이 된다.
     */
    it('core MA_DEFAULT_PERIODS에 차트 전용 기간을 더해 오름차순으로 정렬한 것과 같다', () => {
        const expected = [...MA_DEFAULT_PERIODS, ...CHART_ONLY_MA_PERIODS].sort(
            (a, b) => a - b
        );
        expect([...CHART_MA_PERIODS]).toEqual(expected);
    });

    it('50일선을 포함하고, 차트 전용 기간은 core 기본 기간과 겹치지 않는다', () => {
        expect(CHART_MA_PERIODS).toContain(50);
        for (const period of CHART_ONLY_MA_PERIODS) {
            expect(MA_DEFAULT_PERIODS).not.toContain(period);
        }
    });
});

describe('withChartOnlyMaPeriods', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
    const bars = barsWithCloses(closes);

    it('core 결과에 없는 50일선을 봉 종가로 계산해 채우고, 기존 기간은 그대로 둔다', () => {
        const ma20 = calculateMA(bars, 20);
        const indicators: IndicatorResult = {
            ...EMPTY_INDICATOR_RESULT,
            ma: { 20: ma20 },
        };

        const result = withChartOnlyMaPeriods(indicators, bars);

        expect(result.ma[20]).toBe(ma20);
        const ma50 = result.ma[50];
        expect(ma50).toHaveLength(bars.length);
        // 앞 49개 봉은 값이 없고, 50번째 봉(인덱스 49)은 종가 100..149의 평균 124.5.
        expect(ma50?.[48]).toBeNull();
        expect(ma50?.[49]).toBeCloseTo(124.5, 10);
        // 마지막 봉(인덱스 59)은 종가 110..159의 평균 134.5.
        expect(ma50?.[59]).toBeCloseTo(134.5, 10);
    });

    it('입력 객체를 바꾸지 않는다', () => {
        const indicators: IndicatorResult = {
            ...EMPTY_INDICATOR_RESULT,
            ma: {},
        };
        withChartOnlyMaPeriods(indicators, bars);
        expect(indicators.ma[50]).toBeUndefined();
    });

    it('이미 50일선이 있으면 같은 참조를 돌려준다', () => {
        const indicators: IndicatorResult = {
            ...EMPTY_INDICATOR_RESULT,
            ma: { 50: calculateMA(bars, 50) },
        };
        expect(withChartOnlyMaPeriods(indicators, bars)).toBe(indicators);
    });

    it('봉이 없으면 같은 참조를 돌려준다', () => {
        const indicators: IndicatorResult = {
            ...EMPTY_INDICATOR_RESULT,
            ma: {},
        };
        expect(withChartOnlyMaPeriods(indicators, [])).toBe(indicators);
    });
});
