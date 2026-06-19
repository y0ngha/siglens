import { describe, it, expect } from 'vitest';
import {
    etDateOf,
    addEtDays,
    pastWindowStart,
    futureWindowEnd,
    PAST_WINDOW_DAYS,
    FUTURE_WINDOW_DAYS,
} from '@/entities/economy/lib/calendarWindow';

describe('etDateOf', () => {
    it('formats a UTC instant to its ET YYYY-MM-DD', () => {
        // 2026-01-15T02:00:00Z is still 2026-01-14 21:00 in ET (UTC-5).
        expect(etDateOf(new Date('2026-01-15T02:00:00Z'))).toBe('2026-01-14');
    });

    it('handles afternoon UTC staying same ET day', () => {
        expect(etDateOf(new Date('2026-01-15T18:00:00Z'))).toBe('2026-01-15');
    });
});

describe('addEtDays', () => {
    it('adds days to a YYYY-MM-DD string', () => {
        expect(addEtDays('2026-01-31', 1)).toBe('2026-02-01');
    });
    it('subtracts days with a negative delta', () => {
        expect(addEtDays('2026-03-01', -1)).toBe('2026-02-28');
    });
    it('crosses a year boundary', () => {
        expect(addEtDays('2025-12-31', 1)).toBe('2026-01-01');
    });
});

describe('window bounds', () => {
    it('pastWindowStart is PAST_WINDOW_DAYS before the anchor', () => {
        expect(pastWindowStart('2026-06-20')).toBe(
            addEtDays('2026-06-20', -PAST_WINDOW_DAYS)
        );
    });
    it('futureWindowEnd is FUTURE_WINDOW_DAYS after the anchor', () => {
        expect(futureWindowEnd('2026-06-20')).toBe(
            addEtDays('2026-06-20', FUTURE_WINDOW_DAYS)
        );
    });
    it('past window is at least two weeks', () => {
        expect(PAST_WINDOW_DAYS).toBeGreaterThanOrEqual(14);
    });
});
