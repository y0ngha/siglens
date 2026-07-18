import { describe, expect, it } from 'vitest';
import type { Bar } from '@y0ngha/siglens-core';
import { computeVolumeByBand } from '../lib/volumeByBand';

function bar(close: number, volume: number): Bar {
    return { time: 0, open: close, high: close, low: close, close, volume };
}

describe('computeVolumeByBand', () => {
    it('bars distributed across bands → correct percentages summing to ~100', () => {
        // low=100, high=200, bandCount=5 → width=20 → bands [100,120) [120,140)
        // [140,160) [160,180) [180,200]
        const bars: Bar[] = [
            bar(110, 100), // band 0
            bar(130, 300), // band 1
            bar(150, 200), // band 2
            bar(170, 300), // band 3
            bar(190, 100), // band 4
        ];
        const result = computeVolumeByBand(bars, 100, 200, 5);
        expect(result).not.toBeNull();
        expect(result).toEqual([10, 30, 20, 30, 10]);
        expect(result!.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    });

    it('sums multiple bars landing in the same band', () => {
        const bars: Bar[] = [bar(105, 50), bar(115, 50), bar(190, 100)];
        const result = computeVolumeByBand(bars, 100, 200, 5);
        expect(result).not.toBeNull();
        expect(result![0]).toBeCloseTo(50); // (50+50)/200*100
        expect(result![4]).toBeCloseTo(50);
        expect(result![1]).toBe(0);
        expect(result![2]).toBe(0);
        expect(result![3]).toBe(0);
    });

    it('empty bars → null', () => {
        expect(computeVolumeByBand([], 100, 200, 5)).toBeNull();
    });

    it('all-zero volume → null (total volume is 0)', () => {
        const bars: Bar[] = [bar(110, 0), bar(150, 0)];
        expect(computeVolumeByBand(bars, 100, 200, 5)).toBeNull();
    });

    it('low >= high (degenerate/inverted range) → null', () => {
        const bars: Bar[] = [bar(150, 100)];
        expect(computeVolumeByBand(bars, 200, 100, 5)).toBeNull();
        expect(computeVolumeByBand(bars, 150, 150, 5)).toBeNull();
    });

    it('non-finite low/high → null', () => {
        const bars: Bar[] = [bar(150, 100)];
        expect(computeVolumeByBand(bars, NaN, 200, 5)).toBeNull();
        expect(computeVolumeByBand(bars, 100, Infinity, 5)).toBeNull();
    });

    it('invalid bandCount → null', () => {
        const bars: Bar[] = [bar(150, 100)];
        expect(computeVolumeByBand(bars, 100, 200, 0)).toBeNull();
        expect(computeVolumeByBand(bars, 100, 200, -1)).toBeNull();
        expect(computeVolumeByBand(bars, 100, 200, 2.5)).toBeNull();
    });

    it('a bar exactly on an interior band boundary is deterministically assigned to the upper band (inclusive-low/exclusive-high)', () => {
        // width=20 → close=120 is exactly the boundary between band 0 [100,120)
        // and band 1 [120,140).
        const bars: Bar[] = [bar(120, 100)];
        const result = computeVolumeByBand(bars, 100, 200, 5);
        expect(result).toEqual([0, 100, 0, 0, 0]);
    });

    it('a bar exactly at the top boundary (close === high) is clamped into the last band, not dropped', () => {
        const bars: Bar[] = [bar(200, 100)];
        const result = computeVolumeByBand(bars, 100, 200, 5);
        expect(result).toEqual([0, 0, 0, 0, 100]);
    });

    it('a bar exactly at the bottom boundary (close === low) lands in band 0', () => {
        const bars: Bar[] = [bar(100, 100)];
        const result = computeVolumeByBand(bars, 100, 200, 5);
        expect(result).toEqual([100, 0, 0, 0, 0]);
    });

    it('a bar with close < low (out-of-window close, e.g. an intrabar dip below the 52w low) is clamped into band 0, not dropped or negatively indexed', () => {
        // close=80 < low=100 → rawIndex = floor((80-100)/20) = -1, clamped to 0.
        const bars: Bar[] = [bar(80, 100), bar(190, 100)];
        const result = computeVolumeByBand(bars, 100, 200, 5);
        expect(result).toEqual([50, 0, 0, 0, 50]);
    });

    it('ignores bars with non-finite close or non-finite/non-positive volume, still aggregating the rest', () => {
        const bars: Bar[] = [
            bar(110, 100),
            { ...bar(150, 100), close: NaN },
            { ...bar(150, 100), volume: 0 },
            { ...bar(150, 100), volume: -5 },
            bar(190, 100),
        ];
        const result = computeVolumeByBand(bars, 100, 200, 5);
        expect(result).toEqual([50, 0, 0, 0, 50]);
    });
});
