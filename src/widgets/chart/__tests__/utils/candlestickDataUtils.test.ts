import { describe, expect, it } from 'vitest';
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

    it('leaves bars plain when the impulse array is shorter than bars', () => {
        const out = buildCandlestickData([bar(1), bar(2)], ['green'], true);
        expect(out[0].color).toBe(CHART_COLORS.impulseBullish);
        expect('color' in out[1]).toBe(false); // index 1 → undefined → plain
    });

    it('returns [] for empty bars', () => {
        expect(buildCandlestickData([], [], true)).toEqual([]);
    });
});
