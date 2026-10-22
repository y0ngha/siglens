import { describe, expect, it } from 'vitest';
import {
    lastIndexOnOrBefore,
    minusCalendarMonths,
} from '@/app/api/ai/chat/tools/calendarChange';

describe('minusCalendarMonths', () => {
    it('keeps the day of month when the target month has it', () => {
        expect(minusCalendarMonths('2026-10-19', 1)).toBe('2026-09-19');
        expect(minusCalendarMonths('2026-01-15', 3)).toBe('2025-10-15');
        expect(minusCalendarMonths('2026-10-19', 12)).toBe('2025-10-19');
    });

    it('clamps to the last day of a shorter target month', () => {
        expect(minusCalendarMonths('2026-03-31', 1)).toBe('2026-02-28');
        expect(minusCalendarMonths('2024-03-31', 1)).toBe('2024-02-29');
        expect(minusCalendarMonths('2028-02-29', 12)).toBe('2027-02-28');
        expect(minusCalendarMonths('2026-12-31', 3)).toBe('2026-09-30');
    });
});

describe('lastIndexOnOrBefore', () => {
    const bar = (date: string) => ({
        time: Date.parse(`${date}T00:00:00Z`) / 1000,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 1,
    });
    const bars = [bar('2026-09-17'), bar('2026-09-18'), bar('2026-09-21')];

    it('returns the exact date, else the last earlier session', () => {
        expect(lastIndexOnOrBefore(bars, '2026-09-18')).toBe(1);
        expect(lastIndexOnOrBefore(bars, '2026-09-20')).toBe(1);
        expect(lastIndexOnOrBefore(bars, '2026-09-30')).toBe(2);
    });

    it('is -1 when the series starts after the date', () => {
        expect(lastIndexOnOrBefore(bars, '2026-09-16')).toBe(-1);
    });
});
