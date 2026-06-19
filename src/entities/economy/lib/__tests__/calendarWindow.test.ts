import { describe, it, expect } from 'vitest';
import {
    etDateOf,
    kstDateOf,
    addEtDays,
    pastWindowStart,
    futureWindowEnd,
    PAST_WINDOW_DAYS,
    FUTURE_WINDOW_DAYS,
} from '@/entities/economy/lib/calendarWindow';

describe('kstDateOf', () => {
    it('returns same KST day for morning US release (08:30 ET → 12:30Z → KST same day)', () => {
        // 2026-06-20T12:30:00Z = 08:30 ET = 21:30 KST → still 2026-06-20 KST
        expect(kstDateOf(new Date('2026-06-20T12:30:00Z'))).toBe('2026-06-20');
    });

    it('crosses KST midnight: noon ET on 2026-06-20 (16:00Z) → 2026-06-21 KST', () => {
        // 2026-06-20T16:00:00Z = 12:00 ET = 01:00 KST next day (2026-06-21) — exact old-code failure case
        expect(kstDateOf(new Date('2026-06-20T16:00:00Z'))).toBe('2026-06-21');
    });

    it('crosses KST midnight at year boundary', () => {
        // 2026-01-01T20:00:00Z = 05:00 KST 2026-01-02
        expect(kstDateOf(new Date('2026-01-01T20:00:00Z'))).toBe('2026-01-02');
    });

    it('returns a YYYY-MM-DD formatted string', () => {
        expect(kstDateOf(new Date('2026-06-20T12:30:00Z'))).toMatch(
            /^\d{4}-\d{2}-\d{2}$/
        );
    });
});

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
    // spec: 과거 윈도는 최소 2주 — 현재 PAST_WINDOW_DAYS = 14
    it('PAST_WINDOW_DAYS is 14', () => {
        expect(PAST_WINDOW_DAYS).toBe(14);
    });
});
