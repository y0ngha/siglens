import { describe, expect, it } from 'vitest';
import {
    CHART_HEIGHT,
    SVG_PADDING_LEFT,
    SVG_PADDING_TOP,
    buildTrendBars,
    computeTrendLayout,
    periodHitX,
} from '@/widgets/financials/utils/trendChartGeometry';
import type { TrendSeries } from '@/widgets/financials/utils/trendChartTypes';

describe('computeTrendLayout', () => {
    it('음수가 없으면 기준선이 차트 아래쪽이고 높이 전체를 쓴다', () => {
        const layout = computeTrendLayout(
            [{ labelKo: 'a', values: [1, 2] }],
            2
        );
        expect(layout.baselineY).toBe(SVG_PADDING_TOP + CHART_HEIGHT);
        expect(layout.availableHeight).toBe(CHART_HEIGHT);
        expect(layout.maxAbs).toBe(2);
    });

    it('음수가 있으면 기준선이 가운데로 올라가고 높이는 절반이다', () => {
        const layout = computeTrendLayout(
            [{ labelKo: 'a', values: [-4, 2] }],
            2
        );
        expect(layout.baselineY).toBe(SVG_PADDING_TOP + CHART_HEIGHT / 2);
        expect(layout.availableHeight).toBe(CHART_HEIGHT / 2);
        expect(layout.maxAbs).toBe(4);
    });

    it('값이 전부 0이면 분모를 1로 둔다', () => {
        const layout = computeTrendLayout(
            [{ labelKo: 'a', values: [0, null] }],
            2
        );
        expect(layout.maxAbs).toBe(1);
    });

    it('시리즈 수로 막대 폭을 나눈다', () => {
        const one = computeTrendLayout([{ labelKo: 'a', values: [1] }], 1);
        const two = computeTrendLayout(
            [
                { labelKo: 'a', values: [1] },
                { labelKo: 'b', values: [1] },
            ],
            1
        );
        expect(two.singleBarWidth).toBeCloseTo(one.singleBarWidth / 2);
    });
});

describe('buildTrendBars', () => {
    const SERIES: TrendSeries[] = [
        { labelKo: 'a', values: [10, null, -10], color: 'bullish' },
        { labelKo: 'b', values: [0, 5, 5] },
    ];

    it('값이 없거나 높이가 0인 막대는 만들지 않는다', () => {
        const bars = buildTrendBars(SERIES, computeTrendLayout(SERIES, 3));
        expect(bars.map(b => b.key)).toEqual(['0-0', '0-2', '1-1', '1-2']);
    });

    it('양수는 기준선 위로, 음수는 기준선 아래로 자란다', () => {
        const layout = computeTrendLayout(SERIES, 3);
        const bars = buildTrendBars(SERIES, layout);
        const positive = bars.find(b => b.key === '0-0')!;
        const negative = bars.find(b => b.key === '0-2')!;
        expect(positive.y + positive.height).toBeCloseTo(layout.baselineY);
        expect(negative.y).toBe(layout.baselineY);
    });

    it('시리즈 선언 색을 그대로 싣는다', () => {
        const bars = buildTrendBars(SERIES, computeTrendLayout(SERIES, 3));
        expect(bars.find(b => b.key === '0-2')!.color).toBe('bullish');
        expect(bars.find(b => b.key === '1-1')!.color).toBeUndefined();
    });
});

describe('periodHitX', () => {
    it('기간 열의 시작 x를 퍼센트로 돌려준다', () => {
        const layout = computeTrendLayout(
            [{ labelKo: 'a', values: [1, 1] }],
            2
        );
        expect(periodHitX(0, layout)).toBe(`${SVG_PADDING_LEFT}%`);
        expect(periodHitX(1, layout)).toBe(
            `${SVG_PADDING_LEFT + layout.barGroupWidth}%`
        );
    });
});
