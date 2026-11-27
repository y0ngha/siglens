import type { Bar } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { computeRangeWindow } from '@/features/agent-tools/lib/rangeWindow';

const bar = (time: number, high: number, low: number, close: number): Bar => ({
    time,
    open: close,
    high,
    low,
    close,
    volume: 1,
});

const label = (time: number): string => `t${time}`;

describe('computeRangeWindow', () => {
    it('finds the high/low and the closing extremes with the bar each was set on', () => {
        const window = [bar(1, 10, 8, 9), bar(2, 12, 6, 11), bar(3, 11, 7, 10)];
        expect(computeRangeWindow(window, null, label)).toMatchObject({
            high: 12,
            highDate: 't2',
            low: 6,
            lowDate: 't2',
            highClose: 11,
            highCloseDate: 't2',
            lowClose: 9,
            lowCloseDate: 't1',
            fromHighPct: null,
            fromLowPct: null,
        });
    });

    it('a tie resolves to the LATER bar (the most recent touch)', () => {
        const window = [bar(1, 12, 6, 9), bar(2, 12, 6, 9), bar(3, 10, 8, 9)];
        expect(computeRangeWindow(window, null, label)).toMatchObject({
            highDate: 't2',
            lowDate: 't2',
        });
    });

    it('measures the last close against the high and the low', () => {
        // high 12, low 6: (24-12)/12 = +100%, (24-6)/6 = +300%
        const window = [bar(1, 12, 6, 9)];
        expect(computeRangeWindow(window, 24, label)).toMatchObject({
            fromHighPct: 100,
            fromLowPct: 300,
        });
    });

    it('a non-finite bar does not poison the window', () => {
        const window = [
            bar(1, 10, 8, 9),
            bar(2, Number.NaN, Number.NEGATIVE_INFINITY, Number.NaN),
            bar(3, 11, 7, 10),
        ];
        expect(computeRangeWindow(window, null, label)).toMatchObject({
            high: 11,
            highDate: 't3',
            low: 7,
            lowDate: 't3',
            highClose: 10,
            lowClose: 9,
        });
    });

    it('an empty window has no extremes', () => {
        expect(computeRangeWindow([], 10, label)).toEqual({
            high: null,
            highDate: null,
            low: null,
            lowDate: null,
            fromHighPct: null,
            fromLowPct: null,
            highClose: null,
            highCloseDate: null,
            fromHighClosePct: null,
            lowClose: null,
            lowCloseDate: null,
            fromLowClosePct: null,
        });
    });
});
