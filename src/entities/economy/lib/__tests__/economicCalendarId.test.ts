import { describe, it, expect } from 'vitest';
// economicCalendarId(country, dateEt, event) — actual은 파라미터가 아니므로 해시에서 구조적으로 제외(발표 후 actual 변경 시 같은 id로 upsert).
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
