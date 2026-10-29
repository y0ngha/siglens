import { describe, expect, it } from 'vitest';
import { estimateLabelWidth, linearScale } from '@/views/guide/lib/chartLayout';
import {
    legendPositions,
    paneDomain,
    paneLevelText,
    paneTicks,
    paneTickText,
} from '@/views/guide/lib/demoPaneLayout';

describe('paneDomain', () => {
    it('uses an explicit range as is', () => {
        expect(paneDomain({ label: 'RSI', range: [0, 100] })).toEqual([0, 100]);
    });

    it('falls back to [0, 1] when the pane has no values', () => {
        expect(paneDomain({ label: 'X' })).toEqual([0, 1]);
    });

    it('pads line and level values by 12% and skips gaps', () => {
        const [min, max] = paneDomain({
            label: 'X',
            lines: [{ values: [10, null, Number.NaN, 20], label: 'a' }],
            levels: [{ value: 30 }],
        });
        expect(min).toBeCloseTo(10 - 20 * 0.12);
        expect(max).toBeCloseTo(30 + 20 * 0.12);
    });

    it('includes the zero baseline for a histogram', () => {
        const [min] = paneDomain({ label: 'V', histogram: [5, 8] });
        expect(min).toBeCloseTo(0 - 8 * 0.12);
    });
});

describe('paneTickText / paneLevelText', () => {
    it('compacts large values and keeps step decimals otherwise', () => {
        expect(paneTickText(25_000, 10)).toBe('25K');
        expect(paneTickText(0.25, 0.05)).toBe('0.25');
    });

    it('prints a level with up to four decimals regardless of the tick step', () => {
        expect(paneLevelText(12.5)).toBe('12.5');
        expect(paneLevelText(0.123456)).toBe('0.1235');
        expect(paneLevelText(12_345)).toBe('12K');
    });
});

describe('paneTicks', () => {
    const yOf = linearScale(0, 100, 78, 0);

    it('drops ticks that would sit on a level line, but keeps the full step', () => {
        expect(paneTicks(0, 100, [], yOf)).toEqual({
            ticks: [0, 50, 100],
            step: 50,
        });
        expect(paneTicks(0, 100, [52], yOf)).toEqual({
            ticks: [0, 100],
            step: 50,
        });
    });

    it('derives the step from the range when only one tick fits', () => {
        expect(paneTicks(1.1, 1.9, [], linearScale(1.1, 1.9, 78, 0))).toEqual({
            ticks: [1.5],
            step: 0.5,
        });
    });
});

describe('legendPositions', () => {
    it('starts after the pane name and advances by each previous label width', () => {
        const name = estimateLabelWidth('MACD', 12);
        const first = 6 + 4 + name + 10;
        expect(legendPositions('MACD', ['MACD', 'Signal'], 6, 12)).toEqual([
            first,
            first + estimateLabelWidth('MACD', 12) + 10,
        ]);
    });

    it('returns nothing without legend labels', () => {
        expect(legendPositions('X', [], 6, 12)).toEqual([]);
    });
});
