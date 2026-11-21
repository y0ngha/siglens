import {
    buildOutcomeWindow,
    outcomeEarliestLabelTime,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/shared/config/time';
import {
    BAR_MINUTES,
    MIN_DEFER_MS,
    STALLED_RETRY_MS,
    STALL_GIVE_UP_MS,
    decideInsufficientForward,
    isTimeframe,
} from '../../lib/outcomePolicy';

const NOW = new Date('2026-12-01T07:00:00Z');
const base = {
    timeframe: '1Day' as Timeframe,
    now: NOW,
    previousHave: null,
    previousStalledSince: null,
};

describe('BAR_MINUTES against core', () => {
    const TIMEFRAMES = Object.keys(BAR_MINUTES) as Timeframe[];
    const GENERATED = new Date('2026-11-02T12:00:00Z');

    /** `need` of a window with no forward bar: core's `OUTCOME_WINDOW_BARS`, which is not a public export. */
    const need = (() => {
        const result = buildOutcomeWindow(
            [
                {
                    time: 1_000,
                    open: 1,
                    high: 2,
                    low: 1,
                    close: 1.5,
                    volume: 1,
                },
            ],
            { barTime: 1_000, closeAtAnalysis: 1.5, closedAtAnalysis: true }
        );
        return result.status === 'insufficient_forward' ? result.need : -1;
    })();

    it('reads core need as 20 forward bars', () => {
        expect(need).toBe(20);
    });

    it.each(TIMEFRAMES)(
        '%s: earliest label time is `need` bars of this table later',
        timeframe => {
            const earliest = outcomeEarliestLabelTime(GENERATED, timeframe);
            expect(
                (earliest.getTime() - GENERATED.getTime()) / MS_PER_MINUTE
            ).toBe(need * BAR_MINUTES[timeframe]);
        }
    );

    it('covers every Timeframe literal of core and nothing else', () => {
        const core: Record<Timeframe, true> = {
            '5Min': true,
            '15Min': true,
            '30Min': true,
            '1Hour': true,
            '4Hour': true,
            '1Day': true,
        };
        expect(TIMEFRAMES.toSorted()).toEqual(Object.keys(core).toSorted());
    });
});

describe('isTimeframe', () => {
    it('accepts core timeframes and rejects others, including inherited keys', () => {
        expect(isTimeframe('1Day')).toBe(true);
        expect(isTimeframe('15Min')).toBe(true);
        expect(isTimeframe('1Week')).toBe(false);
        expect(isTimeframe('toString')).toBe(false);
        expect(isTimeframe('')).toBe(false);
    });
});

describe('decideInsufficientForward', () => {
    it('first observation: waits the missing bars at the bar length and records have', () => {
        expect(
            decideInsufficientForward({ ...base, have: 14, need: 20 })
        ).toEqual({
            kind: 'defer',
            nextAttemptAt: new Date(NOW.getTime() + 6 * MS_PER_DAY),
            forwardHave: 14,
            stalledSince: null,
        });
    });

    it('never waits less than one hour (intraday, one bar short)', () => {
        const decision = decideInsufficientForward({
            ...base,
            timeframe: '5Min',
            have: 19,
            need: 20,
        });
        expect(decision).toMatchObject({
            kind: 'defer',
            nextAttemptAt: new Date(NOW.getTime() + MIN_DEFER_MS),
        });
        expect(MIN_DEFER_MS).toBe(MS_PER_HOUR);
    });

    it('have grew: clears a stall marker', () => {
        expect(
            decideInsufficientForward({
                ...base,
                have: 17,
                need: 20,
                previousHave: 14,
                previousStalledSince: new Date(NOW.getTime() - 4 * MS_PER_DAY),
            })
        ).toEqual({
            kind: 'defer',
            nextAttemptAt: new Date(NOW.getTime() + 3 * MS_PER_DAY),
            forwardHave: 17,
            stalledSince: null,
        });
    });

    it('have did not grow (first time): starts the stall clock and retries in a day', () => {
        expect(
            decideInsufficientForward({
                ...base,
                have: 14,
                need: 20,
                previousHave: 14,
            })
        ).toEqual({
            kind: 'defer',
            nextAttemptAt: new Date(NOW.getTime() + STALLED_RETRY_MS),
            forwardHave: 14,
            stalledSince: NOW,
        });
    });

    it('have did not grow: keeps the original stall start while under the limit', () => {
        const stalledSince = new Date(NOW.getTime() - STALL_GIVE_UP_MS + 1);
        expect(
            decideInsufficientForward({
                ...base,
                have: 14,
                need: 20,
                previousHave: 14,
                previousStalledSince: stalledSince,
            })
        ).toMatchObject({ kind: 'defer', stalledSince });
    });

    it('gives up once have has not grown for the stall limit', () => {
        expect(
            decideInsufficientForward({
                ...base,
                have: 14,
                need: 20,
                previousHave: 14,
                previousStalledSince: new Date(
                    NOW.getTime() - STALL_GIVE_UP_MS
                ),
            })
        ).toEqual({ kind: 'give_up' });
    });

    it('a smaller have counts as no growth', () => {
        expect(
            decideInsufficientForward({
                ...base,
                have: 12,
                need: 20,
                previousHave: 14,
                previousStalledSince: new Date(
                    NOW.getTime() - STALL_GIVE_UP_MS - 1
                ),
            })
        ).toEqual({ kind: 'give_up' });
    });

    it('the limit outlasts the longest legitimate exchange closure', () => {
        // Longest scheduled run of closed days used by the app's session helpers is 10 days (`MAX_REWIND_DAYS`).
        expect(STALL_GIVE_UP_MS).toBeGreaterThanOrEqual(10 * MS_PER_DAY);
    });
});
