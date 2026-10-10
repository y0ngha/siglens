import { describe, expect, it } from 'vitest';
import {
    estimateLabelWidth,
    formatCompact,
    formatTick,
    linearScale,
    niceStep,
    niceTicks,
    placeLabel,
    splitRuns,
    type LabelBox,
} from '@/views/guide/lib/chartLayout';

describe('linearScale', () => {
    it('maps the domain onto the range and centres a degenerate domain', () => {
        const scale = linearScale(0, 10, 100, 0);
        expect(scale(0)).toBe(100);
        expect(scale(10)).toBe(0);
        expect(scale(5)).toBe(50);
        expect(linearScale(3, 3, 0, 10)(3)).toBe(5);
    });
});

describe('niceTicks', () => {
    it('picks 1/2/5 steps inside the range', () => {
        const ticks = niceTicks(92, 131, 5);
        expect(ticks).toEqual([100, 110, 120, 130]);
        expect(formatTick(100, 10)).toBe('100');
    });

    it('uses decimals for small steps', () => {
        const ticks = niceTicks(0, 1, 4);
        expect(ticks[0]).toBe(0);
        expect(ticks).toEqual([0, 0.5, 1]);
        expect(formatTick(0.5, ticks[1] - ticks[0])).toBe('0.5');
        expect(formatTick(0.25, 0.05)).toBe('0.25');
    });
});

describe('placeLabel', () => {
    const bounds = { top: 0, bottom: 200 };

    it('pushes an overlapping label out until it is free', () => {
        const placed: LabelBox[] = [];
        const first = placeLabel(
            placed,
            { x: 10, y: 50, width: 40, height: 14 },
            -1,
            bounds
        );
        const second = placeLabel(
            placed,
            { x: 20, y: 50, width: 40, height: 14 },
            -1,
            bounds
        );
        expect(first.y).toBe(50);
        expect(second.y).toBeLessThan(50 - 14 + 1);
    });

    it('keeps labels inside the vertical bounds', () => {
        const placed: LabelBox[] = [];
        const box = placeLabel(
            placed,
            { x: 0, y: -30, width: 10, height: 14 },
            -1,
            bounds
        );
        expect(box.y).toBe(0);
    });
});

describe('splitRuns', () => {
    it('breaks lines at null values', () => {
        const runs = splitRuns(
            [1, 2, null, 4],
            i => i,
            v => v
        );
        expect(runs).toHaveLength(2);
        expect(runs[0]).toHaveLength(2);
        expect(runs[1]).toEqual([{ x: 3, y: 4 }]);
    });
});

describe('estimateLabelWidth', () => {
    it('counts wide characters as wider', () => {
        expect(estimateLabelWidth('가가', 12)).toBeGreaterThan(
            estimateLabelWidth('ab', 12)
        );
    });
});

describe('formatCompact', () => {
    it('shortens large numbers', () => {
        expect(formatCompact(-200_000_000)).toBe('-200M');
        expect(formatCompact(1_500_000_000)).toBe('1.5B');
        expect(formatCompact(250_000)).toBe('250K');
        expect(formatCompact(512)).toBe('512');
    });
});

describe('placeLabel fallback', () => {
    it('tries the opposite direction when the preferred side is blocked by the bounds', () => {
        const placed: LabelBox[] = [];
        const bounds = { top: 0, bottom: 100 };
        const a = placeLabel(
            placed,
            { x: 0, y: 0, width: 30, height: 14 },
            -1,
            bounds
        );
        const b = placeLabel(
            placed,
            { x: 0, y: 0, width: 30, height: 14 },
            -1,
            bounds
        );
        expect(a.y).toBe(0);
        expect(b.y).toBeGreaterThanOrEqual(15);
    });
});

describe('placeLabel with obstacles', () => {
    const bounds = { top: 0, bottom: 200, left: 0, right: 300 };

    it('moves a label off the candles under it, to the nearest free side', () => {
        const candle: LabelBox = { x: 40, y: 40, width: 8, height: 60 };
        const result = placeLabel(
            [],
            { x: 20, y: 60, width: 40, height: 14 },
            -1,
            bounds,
            [candle]
        );
        const clear =
            result.x + result.width <= candle.x ||
            result.x >= candle.x + candle.width ||
            result.y + result.height <= candle.y ||
            result.y >= candle.y + candle.height;
        expect(clear).toBe(true);
    });

    it('keeps the label inside the horizontal bounds', () => {
        const result = placeLabel(
            [],
            { x: 0, y: 60, width: 40, height: 14 },
            -1,
            bounds,
            [{ x: 0, y: 50, width: 60, height: 40 }]
        );
        expect(result.x).toBeGreaterThanOrEqual(0);
        expect(result.x + result.width).toBeLessThanOrEqual(300);
    });
});

describe('niceStep', () => {
    it('rounds a raw step up to 1, 2, 5 x 10^n', () => {
        expect(niceStep(0.3)).toBe(0.5);
        expect(niceStep(1.4)).toBe(2);
        expect(niceStep(700_000)).toBe(1_000_000);
    });
});
