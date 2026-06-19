import { describe, it, expect } from 'vitest';
import { economicCalendarId } from '@/entities/economy/lib/economicCalendarId';

describe('economicCalendarId', () => {
    it('is deterministic for the same inputs', () => {
        const a = economicCalendarId(
            'US',
            '2026-05-13 08:30:00',
            'Core CPI MoM (Apr)'
        );
        const b = economicCalendarId(
            'US',
            '2026-05-13 08:30:00',
            'Core CPI MoM (Apr)'
        );
        expect(a).toBe(b);
    });

    it('produces a fixed-length lowercase hex string', () => {
        const id = economicCalendarId(
            'US',
            '2026-05-13 08:30:00',
            'Core CPI MoM (Apr)'
        );
        expect(id).toMatch(/^[0-9a-f]{64}$/);
    });

    it('excludes actual — different actual is irrelevant because actual is not an input', () => {
        // Same country+dateEt+event must always collide so post-release upserts
        // land on the same row.
        const before = economicCalendarId(
            'US',
            '2026-05-13 08:30:00',
            'Core CPI MoM (Apr)'
        );
        const after = economicCalendarId(
            'US',
            '2026-05-13 08:30:00',
            'Core CPI MoM (Apr)'
        );
        expect(before).toBe(after);
    });

    it('differs when any component differs', () => {
        const base = economicCalendarId(
            'US',
            '2026-05-13 08:30:00',
            'Core CPI MoM (Apr)'
        );
        expect(
            economicCalendarId(
                'EU',
                '2026-05-13 08:30:00',
                'Core CPI MoM (Apr)'
            )
        ).not.toBe(base);
        expect(
            economicCalendarId(
                'US',
                '2026-05-14 08:30:00',
                'Core CPI MoM (Apr)'
            )
        ).not.toBe(base);
        expect(
            economicCalendarId('US', '2026-05-13 08:30:00', 'CPI MoM (Apr)')
        ).not.toBe(base);
    });

    it('is not fooled by component-boundary ambiguity', () => {
        // 'a' + 'bc' vs 'ab' + 'c' must not collide — a delimiter separates parts.
        expect(economicCalendarId('US', 'x', 'yz')).not.toBe(
            economicCalendarId('US', 'xy', 'z')
        );
    });
});
