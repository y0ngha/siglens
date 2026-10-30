import { describe, expect, it } from 'vitest';
import type { Bar } from '@y0ngha/siglens-core';
import { isoDateDaysAgo, sliceFrom, utcMidnightSeconds } from '../barsWindow';

const bar = (time: number): Bar => ({
    time,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
});

describe('isoDateDaysAgo', () => {
    it('steps back across a month boundary in UTC', () => {
        expect(isoDateDaysAgo(new Date('2026-03-02T23:30:00Z'), 3)).toBe(
            '2026-02-27'
        );
    });
});

describe('utcMidnightSeconds', () => {
    it('reads the date part of an ISO timestamp as UTC midnight', () => {
        expect(utcMidnightSeconds('2026-01-02T15:00:00Z')).toBe(1_767_312_000);
    });
});

describe('sliceFrom', () => {
    const bars = [bar(1_767_225_600), bar(1_767_312_000), bar(1_767_398_400)];

    it('returns the input untouched without a from', () => {
        expect(sliceFrom(bars, undefined)).toBe(bars);
    });

    it('keeps bars at or after the from midnight', () => {
        expect(sliceFrom(bars, '2026-01-02').map(b => b.time)).toEqual([
            1_767_312_000, 1_767_398_400,
        ]);
    });
});
