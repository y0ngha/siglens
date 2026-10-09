import { describe, expect, it } from 'vitest';
import {
    mulberry32,
    pathToBars,
    trendBars,
} from '@/views/guide/demos/generators';

describe('mulberry32', () => {
    it('is deterministic per seed', () => {
        const a = mulberry32(1);
        const b = mulberry32(1);
        expect([a(), a(), a()]).toEqual([b(), b(), b()]);
        expect(mulberry32(2)()).not.toBe(mulberry32(1)());
    });
});

describe('pathToBars', () => {
    const points = [
        { i: 0, price: 90 },
        { i: 10, price: 108 },
        { i: 20, price: 98 },
        { i: 30, price: 108 },
        { i: 40, price: 90 },
    ];

    it('pins peak highs and trough lows to the waypoints', () => {
        const bars = pathToBars(points, { seed: 3 });
        expect(bars).toHaveLength(41);
        expect(bars[10].high).toBe(108);
        expect(bars[30].high).toBe(108);
        expect(bars[20].low).toBe(98);
        for (let i = 0; i < bars.length; i++) {
            if (i === 10 || i === 30) continue;
            expect(bars[i].high).toBeLessThan(108);
        }
    });

    it('produces consistent OHLC and optional volume', () => {
        const bars = pathToBars(points, { seed: 3, volume: 1000 });
        for (const bar of bars) {
            expect(bar.high).toBeGreaterThanOrEqual(
                Math.max(bar.open, bar.close)
            );
            expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
            expect(bar.volume).toBeGreaterThan(0);
        }
    });

    it('trendBars ends where it was told to', () => {
        const bars = trendBars(8, 100, 112, { seed: 1, noisePct: 0 });
        expect(bars[7].close).toBeCloseTo(112, 6);
    });
});
