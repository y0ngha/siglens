import {
    CRYPTO_SESSION,
    US_EQUITY_SESSION,
    type Bar,
    type MarketSessionSpec,
} from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { MS_PER_SECOND, SECONDS_PER_DAY } from '@/shared/config/time';
import { closedBars } from '../../lib/closedBars';
import {
    INTRADAY_SETTLE_MINUTES,
    type OutcomeTimeframe,
} from '../../lib/outcomePolicy';

const dailyBar = (isoDate: string): Bar => ({
    time: Date.parse(`${isoDate}T00:00:00Z`) / MS_PER_SECOND,
    open: 1,
    high: 2,
    low: 1,
    close: 1.5,
    volume: 1,
});

const isoDateOf = (bar: Bar): string =>
    new Date(bar.time * MS_PER_SECOND).toISOString().slice(0, 10);

/** Daily bars for every calendar date from `from` to `to`, holidays and weekends included on purpose. */
function dailyBars(from: string, to: string): Bar[] {
    const first = Date.parse(`${from}T00:00:00Z`) / MS_PER_SECOND;
    const last = Date.parse(`${to}T00:00:00Z`) / MS_PER_SECOND;
    return Array.from(
        { length: (last - first) / SECONDS_PER_DAY + 1 },
        (_, i) => ({
            ...dailyBar(from),
            time: first + i * SECONDS_PER_DAY,
        })
    );
}

const keptDates = (
    bars: readonly Bar[],
    spec: MarketSessionSpec,
    now: string
): string[] => closedBars(bars, '1Day', spec, new Date(now)).map(isoDateOf);

/** The last date kept; every earlier calendar date up to the first bar is kept too, so the cut is one boundary. */
const lastKept = (
    bars: readonly Bar[],
    spec: MarketSessionSpec,
    now: string
): string | undefined => keptDates(bars, spec, now).at(-1);

describe('closedBars (1Day)', () => {
    describe('US equity', () => {
        const bars = dailyBars('2026-11-10', '2026-12-01');

        it('keeps the session that closed more than the EOD buffer ago', () => {
            // Tue 2026-11-17 close 21:00 UTC (ET 16:00) + 4 h buffer = 01:00 UTC on the 18th.
            expect(
                lastKept(bars, US_EQUITY_SESSION, '2026-11-18T01:30:00Z')
            ).toBe('2026-11-17');
        });

        it('drops the bar of a session still inside the EOD buffer', () => {
            expect(
                lastKept(bars, US_EQUITY_SESSION, '2026-11-17T22:00:00Z')
            ).toBe('2026-11-16');
        });

        it('drops the forming bar while the session is open', () => {
            expect(
                lastKept(bars, US_EQUITY_SESSION, '2026-11-17T17:00:00Z')
            ).toBe('2026-11-16');
        });

        it('on a weekend keeps Friday and nothing later', () => {
            expect(
                lastKept(bars, US_EQUITY_SESSION, '2026-11-21T12:00:00Z')
            ).toBe('2026-11-20');
        });

        it('on a holiday drops the holiday date and keeps the session before it', () => {
            // Thanksgiving 2026-11-26: a placeholder bar dated on the holiday must not count as closed.
            expect(
                lastKept(bars, US_EQUITY_SESSION, '2026-11-27T10:00:00Z')
            ).toBe('2026-11-25');
        });

        it('on a half day closes at 13:00 ET, not at the regular close', () => {
            // Fri 2026-11-27 closes 18:00 UTC; + 4 h = 22:00 UTC. The regular close would give 01:00 UTC next day.
            expect(
                lastKept(bars, US_EQUITY_SESSION, '2026-11-27T22:30:00Z')
            ).toBe('2026-11-27');
            expect(
                lastKept(bars, US_EQUITY_SESSION, '2026-11-27T21:30:00Z')
            ).toBe('2026-11-25');
        });
    });

    describe('KR equity', () => {
        const bars = dailyBars('2026-12-18', '2026-12-31');

        it('keeps the session once the KRX close (06:30 UTC) plus the buffer has passed', () => {
            expect(
                lastKept(bars, KR_EQUITY_SESSION, '2026-12-22T11:00:00Z')
            ).toBe('2026-12-22');
            expect(
                lastKept(bars, KR_EQUITY_SESSION, '2026-12-22T09:00:00Z')
            ).toBe('2026-12-21');
        });

        it('treats a KRX holiday as no session: Christmas 2026-12-25 is dropped', () => {
            expect(
                lastKept(bars, KR_EQUITY_SESSION, '2026-12-26T00:00:00Z')
            ).toBe('2026-12-24');
        });
    });

    describe('crypto (24/7)', () => {
        const bars = dailyBars('2026-11-15', '2026-11-25');

        it('keeps yesterday (UTC) and drops today, weekends included', () => {
            expect(lastKept(bars, CRYPTO_SESSION, '2026-11-17T05:00:00Z')).toBe(
                '2026-11-16'
            );
            expect(lastKept(bars, CRYPTO_SESSION, '2026-11-22T01:00:00Z')).toBe(
                '2026-11-21'
            );
        });
    });

    it('keeps every older bar and does not modify its input', () => {
        const bars = dailyBars('2026-11-10', '2026-11-20');
        const copy = bars.map(bar => ({ ...bar }));
        const kept = keptDates(bars, US_EQUITY_SESSION, '2026-11-18T12:00:00Z');
        expect(kept[0]).toBe('2026-11-10');
        expect(kept).toHaveLength(8);
        expect(bars).toEqual(copy);
    });
});

describe('closedBars (intraday)', () => {
    const NOW = new Date('2026-11-17T18:00:00Z');
    const nowSeconds = NOW.getTime() / MS_PER_SECOND;
    const settleSeconds = INTRADAY_SETTLE_MINUTES * 60;
    const barAt = (time: number): Bar => ({ ...dailyBar('2026-11-17'), time });

    const cases: ReadonlyArray<readonly [OutcomeTimeframe, number]> = [
        ['5Min', 5 * 60],
        ['15Min', 15 * 60],
        ['30Min', 30 * 60],
        ['1Hour', 60 * 60],
        ['4Hour', 4 * 60 * 60],
    ];

    it.each(cases)(
        '%s: a bar is closed once its end plus the 35 minute settle has passed',
        (timeframe, lengthSeconds) => {
            const exactlySettled = barAt(
                nowSeconds - lengthSeconds - settleSeconds
            );
            const oneSecondShort = barAt(
                nowSeconds - lengthSeconds - settleSeconds + 1
            );
            const forming = barAt(nowSeconds - 60);
            const kept = closedBars(
                [exactlySettled, oneSecondShort, forming],
                timeframe,
                US_EQUITY_SESSION,
                NOW
            );
            expect(kept).toEqual([exactlySettled]);
        }
    );
});
