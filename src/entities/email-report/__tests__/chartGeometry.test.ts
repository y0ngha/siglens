import type { Bar } from '@y0ngha/siglens-core';
import {
    computeChartGeometry,
    REPORT_CHART_BARS,
} from '@/entities/email-report/lib/chartGeometry';

const BOX = { width: 200, height: 120, padding: 10 };

function bar(open: number, close: number, high: number, low: number): Bar {
    return { time: 0, open, close, high, low, volume: 1 };
}

describe('computeChartGeometry', () => {
    it('봉이 없으면 null', () => {
        expect(computeChartGeometry([], {}, BOX)).toBeNull();
    });

    it('고가는 위쪽 여백, 저가는 아래쪽 여백에 닿는다', () => {
        const geo = computeChartGeometry(
            [bar(10, 12, 20, 5), bar(12, 11, 15, 8)],
            {},
            BOX
        )!;

        expect(geo.high).toBe(20);
        expect(geo.low).toBe(5);
        expect(geo.candles[0]!.wickTop).toBe(10);
        expect(geo.candles[0]!.wickBottom).toBe(110);
    });

    it('양봉·음봉을 종가와 시가로 가르고 몸통은 시가·종가 사이다', () => {
        const geo = computeChartGeometry(
            [bar(10, 15, 20, 0), bar(15, 10, 20, 0)],
            {},
            BOX
        )!;

        expect(geo.candles.map(c => c.up)).toEqual([true, false]);
        // 가격 15 → y=10+(5/20)*100=35, 가격 10 → y=60
        expect(geo.candles[0]).toMatchObject({ bodyTop: 35, bodyHeight: 25 });
        expect(geo.candles[1]).toMatchObject({ bodyTop: 35, bodyHeight: 25 });
    });

    it('시가와 종가가 같아도 몸통은 최소 1px이다', () => {
        const geo = computeChartGeometry([bar(10, 10, 12, 8)], {}, BOX)!;

        expect(geo.candles[0]!.bodyHeight).toBe(1);
    });

    it('마지막 REPORT_CHART_BARS개만 그리고 이동평균도 같은 구간으로 자른다', () => {
        const bars = Array.from({ length: REPORT_CHART_BARS + 5 }, (_, i) =>
            bar(10, 11, 12 + (i < 5 ? 100 : 0), 9)
        );
        const ma = { 20: bars.map((_, i) => (i < 5 ? 500 : 10)) };

        const geo = computeChartGeometry(bars, ma, BOX)!;

        expect(geo.candles).toHaveLength(REPORT_CHART_BARS);
        // 잘려 나간 앞쪽 5개의 고가(112)·이동평균(500)이 축에 섞이지 않는다.
        expect(geo.high).toBe(12);
        expect(geo.maLines[0]!.points.split(' ')).toHaveLength(
            REPORT_CHART_BARS
        );
    });

    it('이동평균이 봉 범위를 벗어나면 축을 넓히고 null 값은 건너뛴다', () => {
        const geo = computeChartGeometry(
            [bar(10, 11, 12, 9), bar(10, 11, 12, 9)],
            { 50: [null, 30] },
            BOX
        )!;

        expect(geo.high).toBe(30);
        expect(geo.maLines).toEqual([{ period: 50, points: '150.0,10.0' }]);
    });
});
