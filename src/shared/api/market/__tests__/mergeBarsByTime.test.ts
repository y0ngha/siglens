import { describe, expect, it } from 'vitest';
import type { Bar } from '@y0ngha/siglens-core';
import { mergeBarsByTime } from '@/shared/api/market/mergeBarsByTime';

const bar = (time: number, close: number): Bar => ({
    time,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
});

describe('mergeBarsByTime', () => {
    it('concatenates disjoint ranges in ascending time order', () => {
        const result = mergeBarsByTime([bar(1, 10), bar(2, 11)], [bar(3, 12)]);
        expect(result.map(b => b.time)).toEqual([1, 2, 3]);
    });

    it('dedups overlapping times, preferring recent', () => {
        const result = mergeBarsByTime(
            [bar(1, 10), bar(2, 11)],
            [bar(2, 99), bar(3, 12)]
        );
        expect(result.map(b => [b.time, b.close])).toEqual([
            [1, 10],
            [2, 99], // recent wins
            [3, 12],
        ]);
    });

    it('sorts unsorted inputs by time', () => {
        const result = mergeBarsByTime([bar(3, 12), bar(1, 10)], [bar(2, 11)]);
        expect(result.map(b => b.time)).toEqual([1, 2, 3]);
    });
});
