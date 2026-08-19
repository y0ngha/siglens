import { describe, expect, it, vi } from 'vitest';
import * as reportModule from '@/shared/lib/reportClientError';
import type { Bar } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import {
    buildCandlestickData,
    impulseColor,
} from '@/widgets/chart/utils/candlestickDataUtils';

function bar(time: number, close = 10): Bar {
    return { time, open: 9, high: 11, low: 8, close, volume: 100 };
}

describe('impulseColor', () => {
    it('maps green/red/blue to the impulse palette', () => {
        expect(impulseColor('green')).toBe(CHART_COLORS.impulseBullish);
        expect(impulseColor('red')).toBe(CHART_COLORS.impulseBearish);
        expect(impulseColor('blue')).toBe(CHART_COLORS.impulseNeutral);
    });
});

describe('buildCandlestickData', () => {
    const bars: Bar[] = [bar(1), bar(2), bar(3)];

    it('returns plain OHLC (no color fields) when impulse is inactive', () => {
        const out = buildCandlestickData(bars, ['green', 'red', 'blue'], false);
        expect(out).toEqual([
            { time: 1, open: 9, high: 11, low: 8, close: 10 },
            { time: 2, open: 9, high: 11, low: 8, close: 10 },
            { time: 3, open: 9, high: 11, low: 8, close: 10 },
        ]);
        out.forEach(p => expect('color' in p).toBe(false));
    });

    it('injects color/borderColor/wickColor when active and color present', () => {
        const out = buildCandlestickData([bar(1)], ['green'], true);
        expect(out[0]).toEqual({
            time: 1,
            open: 9,
            high: 11,
            low: 8,
            close: 10,
            color: CHART_COLORS.impulseBullish,
            borderColor: CHART_COLORS.impulseBullish,
            wickColor: CHART_COLORS.impulseBullish,
        });
    });

    it('leaves a bar plain when active but its impulse is null (warm-up)', () => {
        const out = buildCandlestickData([bar(1), bar(2)], [null, 'red'], true);
        expect('color' in out[0]).toBe(false);
        expect(out[1].color).toBe(CHART_COLORS.impulseBearish);
    });

    it('impulse 배열이 짧으면 **최신** 봉부터 칠한다', () => {
        // 예전엔 좌측 정렬이라 가장 오래된 봉이 칠해졌다. 지표 시계열은 끝이 최신이므로
        // 부분 배열의 유효 구간은 tail이다(seriesDataUtils `tailAligned`와 같은 규약).
        const out = buildCandlestickData([bar(1), bar(2)], ['green'], true);
        expect('color' in out[0]).toBe(false); // 지표가 닿지 않는 오래된 봉 → 기본색
        expect(out[1].color).toBe(CHART_COLORS.impulseBullish);
    });

    it('returns [] for empty bars', () => {
        expect(buildCandlestickData([], [], true)).toEqual([]);
    });
});

describe('assertEpochSeconds (bar.time 단위 가드)', () => {
    /**
     * `bar.time as UTCTimestamp`는 검증 없는 캐스트다. 어댑터가 밀리초를 흘리면
     * lightweight-charts가 예외 없이 서기 5만년에 캔들을 그리고 HTTP 200이 나간다.
     * 화면을 직접 보지 않으면 아무도 모르는 부류라, 이 가드가 유일한 신호다.
     */
    it('epoch 초 범위면 아무것도 보고하지 않는다', () => {
        const spy = vi.spyOn(reportModule, 'reportClientError');
        buildCandlestickData([bar(1_700_000_000)], [], false);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('밀리초(1e11 초과)면 값과 함께 보고한다', () => {
        const spy = vi
            .spyOn(reportModule, 'reportClientError')
            .mockImplementation(() => {});
        buildCandlestickData([bar(1_700_000_000_000)], [], false);

        expect(spy).toHaveBeenCalledOnce();
        const [error, context] = spy.mock.calls[0]!;
        expect((error as Error).message).toContain('1700000000000');
        expect(context).toBe('buildCandlestickData');
        spy.mockRestore();
    });

    it('빈 배열은 보고하지 않는다 (첫 봉이 없다)', () => {
        const spy = vi.spyOn(reportModule, 'reportClientError');
        expect(buildCandlestickData([], [], false)).toEqual([]);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
