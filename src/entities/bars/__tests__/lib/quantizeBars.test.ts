import { describe, expect, it, vi } from 'vitest';
import type { Bar } from '@y0ngha/siglens-core';

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    isEtRegularSessionOpen: vi.fn(),
}));

import { isEtRegularSessionOpen } from '@y0ngha/siglens-core';
import { quantizeBarsToLastClosed } from '@/entities/bars/lib/quantizeBars';

const mockOpen = vi.mocked(isEtRegularSessionOpen);

function bar(close: number): Bar {
    return {
        time: close,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1,
    };
}

describe('quantizeBarsToLastClosed', () => {
    const now = new Date('2026-06-05T18:00:00Z');

    it('drops the last (forming) bar during regular session', () => {
        mockOpen.mockReturnValue(true);
        const bars = [bar(1), bar(2), bar(3)];
        expect(quantizeBarsToLastClosed(bars, now)).toEqual([bar(1), bar(2)]);
    });

    it('keeps all bars when the session is closed (last bar already complete)', () => {
        mockOpen.mockReturnValue(false);
        const bars = [bar(1), bar(2), bar(3)];
        expect(quantizeBarsToLastClosed(bars, now)).toEqual([
            bar(1),
            bar(2),
            bar(3),
        ]);
    });

    it('returns input unchanged for empty bars', () => {
        mockOpen.mockReturnValue(true);
        expect(quantizeBarsToLastClosed([], now)).toEqual([]);
    });

    // WORST-CASE tests
    it('returns empty array when length-1 input during open session', () => {
        mockOpen.mockReturnValue(true);
        const bars = [bar(42)];
        expect(quantizeBarsToLastClosed(bars, now)).toEqual([]);
    });

    it('does not mutate the input array (open session returns a new array via slice)', () => {
        mockOpen.mockReturnValue(true);
        const bars = [bar(1), bar(2), bar(3)];
        const result = quantizeBarsToLastClosed(bars, now);
        // slice returns a new array reference — not the same object
        expect(result).not.toBe(bars);
        // original is untouched
        expect(bars).toHaveLength(3);
    });

    it('closed session returns the same reference (no unnecessary copy)', () => {
        mockOpen.mockReturnValue(false);
        const bars = [bar(1), bar(2), bar(3)];
        const result = quantizeBarsToLastClosed(bars, now);
        // acceptable: readonly input returned as-is
        expect(result).toBe(bars);
    });

    it('calls isEtRegularSessionOpen with the exact now Date passed in', () => {
        mockOpen.mockReturnValue(false);
        const specificNow = new Date('2026-06-05T20:30:00Z');
        quantizeBarsToLastClosed([bar(1)], specificNow);
        expect(mockOpen).toHaveBeenCalledWith(specificNow);
    });
});
