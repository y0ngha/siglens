import type { Bar, SupertrendResult } from '@y0ngha/siglens-core';
import type { UTCTimestamp } from 'lightweight-charts';
import {
    buildSeriesData,
    buildSeriesDataFromValues,
    buildTrendSplitData,
    buildZeroLineDots,
} from '@/widgets/chart/utils/seriesDataUtils';

const mockBars: Bar[] = [
    { time: 100, open: 10, high: 15, low: 9, close: 12, volume: 1000 },
    { time: 200, open: 12, high: 18, low: 11, close: 15, volume: 1200 },
    { time: 300, open: 15, high: 20, low: 14, close: 18, volume: 1100 },
];

describe('buildSeriesData', () => {
    it('maps indicator values to series points with time from bars', () => {
        const indicatorData = [{ rsi: 70 }, { rsi: 65 }, { rsi: 80 }];

        const result = buildSeriesData(mockBars, indicatorData, 'rsi');

        expect(result).toEqual([
            { time: 100 as UTCTimestamp, value: 70 },
            { time: 200 as UTCTimestamp, value: 65 },
            { time: 300 as UTCTimestamp, value: 80 },
        ]);
    });

    it('produces WhitespaceData for null values', () => {
        const indicatorData = [{ rsi: 70 }, { rsi: null }, { rsi: 80 }];

        const result = buildSeriesData(mockBars, indicatorData, 'rsi');

        expect(result[1]).toEqual({ time: 200 as UTCTimestamp });
        expect(result[1]).not.toHaveProperty('value');
    });

    it('produces WhitespaceData for undefined values', () => {
        const indicatorData = [{ rsi: 70 }, { rsi: undefined }, { rsi: 80 }];

        const result = buildSeriesData(mockBars, indicatorData, 'rsi');

        expect(result[1]).toEqual({ time: 200 as UTCTimestamp });
    });

    it('uses Math.min(bars, indicatorData) for length', () => {
        const indicatorData = [{ rsi: 70 }];

        const result = buildSeriesData(mockBars, indicatorData, 'rsi');

        expect(result).toHaveLength(1);
    });

    it('returns empty array for empty bars', () => {
        expect(buildSeriesData([], [{ rsi: 70 }], 'rsi')).toEqual([]);
    });

    it('returns empty array for empty indicator data', () => {
        expect(buildSeriesData(mockBars, [], 'rsi')).toEqual([]);
    });

    it('applies colorFn when provided', () => {
        // 봉 3개 + 지표 2개 → tail 정렬이므로 최신 두 봉(200, 300)에 붙는다.
        // 좌측 정렬이던 시절엔 100·200이었다(seriesDataUtils `tailAligned` JSDoc 참조).
        const indicatorData = [{ val: 10 }, { val: -5 }];
        const colorFn = (value: number) => (value >= 0 ? '#00ff00' : '#ff0000');

        const result = buildSeriesData(mockBars, indicatorData, 'val', colorFn);

        expect(result[0]).toEqual({
            time: 200 as UTCTimestamp,
            value: 10,
            color: '#00ff00',
        });
        expect(result[1]).toEqual({
            time: 300 as UTCTimestamp,
            value: -5,
            color: '#ff0000',
        });
    });

    it('does not add color when colorFn is undefined', () => {
        const indicatorData = [{ val: 10 }];

        const result = buildSeriesData(mockBars, indicatorData, 'val');

        expect(result[0]).not.toHaveProperty('color');
    });
});

describe('buildSeriesDataFromValues', () => {
    it('maps values array to series points with time from bars', () => {
        const values = [100, 200, 300];

        const result = buildSeriesDataFromValues(mockBars, values);

        expect(result).toEqual([
            { time: 100 as UTCTimestamp, value: 100 },
            { time: 200 as UTCTimestamp, value: 200 },
            { time: 300 as UTCTimestamp, value: 300 },
        ]);
    });

    it('produces WhitespaceData for null values', () => {
        const values = [100, null, 300];

        const result = buildSeriesDataFromValues(mockBars, values);

        expect(result[1]).toEqual({ time: 200 as UTCTimestamp });
        expect(result[1]).not.toHaveProperty('value');
    });

    it('uses Math.min(bars, values) for length', () => {
        const values = [100];

        const result = buildSeriesDataFromValues(mockBars, values);

        expect(result).toHaveLength(1);
    });

    it('returns empty array for empty bars', () => {
        expect(buildSeriesDataFromValues([], [100])).toEqual([]);
    });

    it('returns empty array for empty values', () => {
        expect(buildSeriesDataFromValues(mockBars, [])).toEqual([]);
    });

    it('handles all null values', () => {
        const values = [null, null, null];

        const result = buildSeriesDataFromValues(mockBars, values);

        expect(result).toHaveLength(3);
        result.forEach(point => {
            expect(point).not.toHaveProperty('value');
        });
    });
});

function bar(time: number): Bar {
    return { time, open: 1, high: 2, low: 0, close: 1, volume: 10 };
}

describe('buildTrendSplitData', () => {
    const bars: Bar[] = [bar(1), bar(2), bar(3)];
    const data: SupertrendResult[] = [
        { supertrend: 10, trend: 'up' },
        { supertrend: 11, trend: 'down' },
        { supertrend: null, trend: null },
    ];
    const getSt = (r: SupertrendResult): number | null => r.supertrend;

    it("returns value only on bars whose trend matches 'up', whitespace otherwise", () => {
        expect(buildTrendSplitData(bars, data, 'up', getSt)).toEqual([
            { time: 1, value: 10 },
            { time: 2 },
            { time: 3 },
        ]);
    });

    it("returns value only on bars whose trend matches 'down', whitespace otherwise", () => {
        expect(buildTrendSplitData(bars, data, 'down', getSt)).toEqual([
            { time: 1 },
            { time: 2, value: 11 },
            { time: 3 },
        ]);
    });

    it('up and down outputs are complementary on matched bars (never both have value)', () => {
        const up = buildTrendSplitData(bars, data, 'up', getSt);
        const down = buildTrendSplitData(bars, data, 'down', getSt);
        up.forEach((u, i) => {
            const bothHaveValue = 'value' in u && 'value' in down[i];
            expect(bothHaveValue).toBe(false);
        });
    });

    it('emits whitespace when the selected value is null even if trend matches dir', () => {
        const nullVal: SupertrendResult[] = [{ supertrend: null, trend: 'up' }];
        expect(buildTrendSplitData([bar(1)], nullVal, 'up', getSt)).toEqual([
            { time: 1 },
        ]);
    });

    it('짧은 지표는 **가장 최신** 봉에 붙는다 (worst case)', () => {
        // 이 테스트는 예전에 `{ time: 1 }`(가장 오래된 봉)을 단언했다 — 그게 버그였다.
        // 지표 시계열은 끝이 최신이므로 부분 배열의 유효 구간은 tail이다.
        // 실측 사례: 봉 501개 + 지표 1개가 2020-09-13 자리에 2022-01-26 값을 찍었다.
        const longBars = [bar(1), bar(2), bar(3), bar(4)];
        const shortData: SupertrendResult[] = [{ supertrend: 5, trend: 'up' }];
        const out = buildTrendSplitData(longBars, shortData, 'up', getSt);
        expect(out).toEqual([{ time: 4, value: 5 }]);
    });

    it('returns empty array for empty inputs', () => {
        expect(buildTrendSplitData([], [], 'up', getSt)).toEqual([]);
    });

    it("supports a 'long'/'short' trend literal with a per-side selector (chandelier shape)", () => {
        const ch = [
            { longStop: 90, shortStop: 110, trend: 'long' as const },
            { longStop: 91, shortStop: 111, trend: 'short' as const },
        ];
        const longBars = [bar(1), bar(2)];
        expect(
            buildTrendSplitData(longBars, ch, 'long', r => r.longStop)
        ).toEqual([{ time: 1, value: 90 }, { time: 2 }]);
        expect(
            buildTrendSplitData(longBars, ch, 'short', r => r.shortStop)
        ).toEqual([{ time: 1 }, { time: 2, value: 111 }]);
    });
});

describe('buildSeriesData colorFn row arg', () => {
    const bars: Bar[] = [bar(1), bar(2)];
    const data = [
        { v: 5, flag: true },
        { v: -3, flag: false },
    ];

    it('passes (value, row) to colorFn — 3번째 index 인자는 없다', () => {
        // index 인자는 제거했다. 호출부 30곳 중 colorFn을 쓰는 4곳이 전부 (value) 또는
        // (value, row)만 받는 죽은 유연성이었고, tail 정렬 도입으로 의미까지 바뀌었다
        // (지표 배열 인덱스 → tail 인덱스). 남겨두면 다음 사람이 옛 의미로 쓴다.
        const seen: Array<[number, unknown]> = [];
        buildSeriesData(bars, data, 'v', (value, row) => {
            seen.push([value, row]);
            return '#fff';
        });
        expect(seen[0]).toEqual([5, { v: 5, flag: true }]);
        expect(seen[1]).toEqual([-3, { v: -3, flag: false }]);
    });

    it('still supports a value-only colorFn (backward compatible)', () => {
        const out = buildSeriesData(bars, data, 'v', value =>
            value >= 0 ? '#0f0' : '#f00'
        );
        expect(out).toEqual([
            { time: 1, value: 5, color: '#0f0' },
            { time: 2, value: -3, color: '#f00' },
        ]);
    });
});

describe('buildZeroLineDots', () => {
    const bars: Bar[] = [bar(1), bar(2), bar(3)];

    it('emits a zero-value point with the colorFn color per row', () => {
        const data = [{ s: 'a' }, { s: 'b' }, { s: 'c' }];
        const out = buildZeroLineDots(bars, data, row =>
            row.s === 'b' ? '#abc' : null
        );
        expect(out).toEqual([
            { time: 1 },
            { time: 2, value: 0, color: '#abc' },
            { time: 3 },
        ]);
    });

    it('emits whitespace when the row is null/undefined', () => {
        const data = [null, { s: 'x' }] as unknown as Array<{ s: string }>;
        const out = buildZeroLineDots(bars.slice(0, 2), data, () => '#fff');
        expect(out).toEqual([
            { time: 1 },
            { time: 2, value: 0, color: '#fff' },
        ]);
    });

    it('짧은 지표는 최신 봉에 붙고, 빈 입력은 []다', () => {
        expect(buildZeroLineDots([], [], () => '#fff')).toEqual([]);
        // 예전엔 `{ time: 1 }`(가장 오래된 봉)을 단언했다 — tail 정렬로 정정.
        expect(buildZeroLineDots(bars, [{ s: 'a' }], () => '#fff')).toEqual([
            { time: bars[bars.length - 1].time, value: 0, color: '#fff' },
        ]);
    });
});

describe('tail 정렬 불변식 (2026-08 도입)', () => {
    const four: Bar[] = [100, 200, 300, 400].map(t => ({
        time: t,
        open: 1,
        high: 2,
        low: 0,
        close: 1,
        volume: 10,
    }));

    it('길이가 같으면 기존 동작과 완전히 동일하다 (무동작 보장)', () => {
        // 프로덕션의 모든 지표 배열은 봉과 같은 길이이고 워밍업 결측은 **앞쪽 null**이다
        // (core `calculateIndicators` 실측: bars 501 → rsi/macd/bollinger 전부 501).
        // 따라서 좌→우 정렬 전환은 기존 데이터에 아무 영향이 없다. 그걸 여기서 고정한다.
        expect(buildSeriesDataFromValues(four, [null, 10, 20, 30])).toEqual([
            { time: 100 },
            { time: 200, value: 10 },
            { time: 300, value: 20 },
            { time: 400, value: 30 },
        ]);
    });

    it('값 1개는 마지막 봉에 붙는다', () => {
        expect(buildSeriesDataFromValues(four, [30])).toEqual([
            { time: 400, value: 30 },
        ]);
    });

    it('값 2개는 마지막 두 봉에 순서대로 붙는다', () => {
        expect(buildSeriesData(four, [{ v: 2 }, { v: 3 }], 'v')).toEqual([
            { time: 300, value: 2 },
            { time: 400, value: 3 },
        ]);
    });

    it('빈 지표는 빈 결과다 — slice(-0) 함정', () => {
        // `slice(-0)`은 `slice(0)`과 같아 **배열 전체**를 돌려준다. 가드가 빠지면
        // 빈 지표에 봉 전체가 짝지어져 정반대 결과가 난다.
        expect(buildSeriesDataFromValues(four, [])).toEqual([]);
        expect(buildSeriesData(four, [], 'v' as never)).toEqual([]);
    });

    it('지표가 봉보다 **길면** 앞에서부터 맞춘다 — 초과분은 과거가 아니라 미래다', () => {
        // tail을 쓰면 안 되는 유일한 경우다. 지표가 봉보다 길다는 건 뒤쪽이 **봉 이후로
        // 투영된 구간**이라는 뜻이다(일목균형표 선행스팬처럼). 그때 tail을 취하면
        // 미래값을 과거 봉에 찍는다. 현재 이 유틸에 도달하는 배열 중 bars보다 긴 것은
        // 없지만(미래 구름은 `extendWithFutureCloud`가 별도로 덧붙인다), 규약을 고정한다.
        expect(buildSeriesDataFromValues(four, [1, 2, 3, 4, 5, 6])).toEqual([
            { time: 100, value: 1 },
            { time: 200, value: 2 },
            { time: 300, value: 3 },
            { time: 400, value: 4 },
        ]);
    });
});
