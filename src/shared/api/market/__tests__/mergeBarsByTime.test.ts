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

    // Fix 4: additional edge-case tests

    it('historical empty, recent non-empty → returns recent sorted', () => {
        const result = mergeBarsByTime([], [bar(3, 12), bar(1, 10)]);
        expect(result.map(b => b.time)).toEqual([1, 3]);
        expect(result.map(b => b.close)).toEqual([10, 12]);
    });

    it('historical non-empty, recent empty → returns historical sorted', () => {
        const result = mergeBarsByTime([bar(3, 12), bar(1, 10)], []);
        expect(result.map(b => b.time)).toEqual([1, 3]);
        expect(result.map(b => b.close)).toEqual([10, 12]);
    });

    it('realistic gap/overlap fixture: no duplicates, no spurious gap, sorted unique union', () => {
        // historical: Mon-Thu of week 1 (times 1..4) + Mon-Wed of week 2 (times 8..10)
        // recent: overlaps with historical on week 2 (times 8..10) and adds Thu-Fri week 2 (times 11,12)
        // weekend gap (times 5,6,7) is intentionally absent from both windows
        const historical = [
            bar(1, 100),
            bar(2, 101),
            bar(3, 102),
            bar(4, 103),
            bar(8, 108), // Mon week 2 — in overlap
            bar(9, 109), // Tue week 2 — in overlap
            bar(10, 110), // Wed week 2 — in overlap
        ];
        const recent = [
            bar(8, 208), // overlap — recent wins
            bar(9, 209), // overlap — recent wins
            bar(10, 210), // overlap — recent wins
            bar(11, 211), // Thu week 2 — only in recent
            bar(12, 212), // Fri week 2 — only in recent
        ];

        const result = mergeBarsByTime(historical, recent);

        // No duplicates: each time appears exactly once
        const times = result.map(b => b.time);
        expect(times).toEqual([1, 2, 3, 4, 8, 9, 10, 11, 12]); // sorted unique

        // Weekend gap (5,6,7) must NOT be synthesised
        expect(times).not.toContain(5);
        expect(times).not.toContain(6);
        expect(times).not.toContain(7);

        // Overlap region uses recent values
        expect(result.find(b => b.time === 8)?.close).toBe(208);
        expect(result.find(b => b.time === 9)?.close).toBe(209);
        expect(result.find(b => b.time === 10)?.close).toBe(210);

        // Non-overlap historical values preserved
        expect(result.find(b => b.time === 1)?.close).toBe(100);
        expect(result.find(b => b.time === 4)?.close).toBe(103);

        // Recent-only values present
        expect(result.find(b => b.time === 11)?.close).toBe(211);
        expect(result.find(b => b.time === 12)?.close).toBe(212);
    });
});
