import { describe, expect, it } from 'vitest';
import type { Bar } from '@y0ngha/siglens-core';
import {
    SQUEEZE_CONTEXT_BARS,
    toSqueezeContext,
} from '../../lib/squeezeContext';

/** `YYYY-MM-DD` 세션의 일봉(`time` = 그 날 UTC 자정, 초). */
function bar(date: string, close: number, volume = 1_000): Bar {
    return {
        time: Date.parse(`${date}T00:00:00Z`) / 1000,
        open: close,
        high: close,
        low: close,
        close,
        volume,
    };
}

describe('toSqueezeContext', () => {
    it('keeps only date, close and volume, with the session date taken from the UTC day of `time`', () => {
        expect(toSqueezeContext([bar('2026-10-15', 251.2, 41_000)])).toEqual({
            dailyBars: [{ date: '2026-10-15', close: 251.2, volume: 41_000 }],
        });
    });

    it(`keeps the last ${SQUEEZE_CONTEXT_BARS} bars (the newest end)`, () => {
        const start = Date.parse('2026-08-01T00:00:00Z');
        const bars = Array.from({ length: SQUEEZE_CONTEXT_BARS + 5 }, (_, i) =>
            bar(
                new Date(start + i * 86_400_000).toISOString().slice(0, 10),
                100 + i
            )
        );
        const context = toSqueezeContext(bars);
        expect(context?.dailyBars).toHaveLength(SQUEEZE_CONTEXT_BARS);
        expect(context?.dailyBars[0].close).toBe(105);
        expect(context?.dailyBars.at(-1)?.close).toBe(
            100 + SQUEEZE_CONTEXT_BARS + 4
        );
    });

    it('drops bars with a non-positive or non-finite close and negative volume', () => {
        const context = toSqueezeContext([
            bar('2026-10-13', 0),
            bar('2026-10-14', Number.NaN),
            bar('2026-10-15', 10, -1),
            bar('2026-10-16', 12),
        ]);
        expect(context?.dailyBars.map(b => b.date)).toEqual(['2026-10-16']);
    });

    it('is undefined without a usable bar (the scorecard then keeps the price-free rule)', () => {
        expect(toSqueezeContext([])).toBeUndefined();
        expect(toSqueezeContext([bar('2026-10-15', -3)])).toBeUndefined();
    });
});
