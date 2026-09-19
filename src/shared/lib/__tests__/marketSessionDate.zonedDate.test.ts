import { describe, expect, it } from 'vitest';
import { zonedDate } from '@/shared/lib/marketSessionDate';

describe('zonedDate', () => {
    it("UTC: returns the instant's own calendar date", () => {
        expect(zonedDate(new Date('2026-09-18T12:00:00.000Z'), 'UTC')).toBe(
            '2026-09-18'
        );
    });

    it('America/New_York (EDT, summer, UTC-4): evening UTC rolls the local date BACK a day', () => {
        // 2026-09-18T01:30:00Z is 2026-09-17T21:30:00 EDT — still 9/17 in ET,
        // even though the UTC date already reads 9/18. This is the exact
        // boundary `isStaleByBars`'s '1Day' trading-date rule depends on.
        expect(
            zonedDate(new Date('2026-09-18T01:30:00.000Z'), 'America/New_York')
        ).toBe('2026-09-17');
    });

    it('America/New_York (EST, winter, UTC-5): DST is resolved automatically by Intl, not a manual offset', () => {
        // 2026-01-15T04:30:00Z is 2026-01-14T23:30:00 EST (winter, UTC-5) —
        // still 1/14 in ET.
        expect(
            zonedDate(new Date('2026-01-15T04:30:00.000Z'), 'America/New_York')
        ).toBe('2026-01-14');
        // 2026-01-15T05:30:00Z is 2026-01-15T00:30:00 EST — now 1/15.
        expect(
            zonedDate(new Date('2026-01-15T05:30:00.000Z'), 'America/New_York')
        ).toBe('2026-01-15');
    });

    it('Asia/Seoul (KST, fixed UTC+9, no DST): early-morning UTC rolls the local date FORWARD a day', () => {
        // 2026-09-17T15:30:00Z is 2026-09-18T00:30:00 KST — already 9/18 in
        // KST even though the UTC date still reads 9/17.
        expect(
            zonedDate(new Date('2026-09-17T15:30:00.000Z'), 'Asia/Seoul')
        ).toBe('2026-09-18');
    });

    it('different time zones for the same instant can legitimately disagree, and repeated calls with different zones do not leak a cached formatter result across zones', () => {
        const instant = new Date('2026-09-18T02:00:00.000Z');
        expect(zonedDate(instant, 'UTC')).toBe('2026-09-18');
        expect(zonedDate(instant, 'America/New_York')).toBe('2026-09-17');
        expect(zonedDate(instant, 'Asia/Seoul')).toBe('2026-09-18');
        // Re-querying UTC after the other zones must still answer UTC's own
        // date, not a leftover from the formatter cache.
        expect(zonedDate(instant, 'UTC')).toBe('2026-09-18');
    });
});
