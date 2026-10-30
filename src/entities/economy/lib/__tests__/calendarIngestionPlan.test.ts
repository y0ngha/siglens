import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { economicCalendarId } from '../economicCalendarId';
import {
    dedupeCalendarEventsById,
    planCalendarIngestion,
} from '../calendarIngestionPlan';

function event(
    overrides: Partial<EconomicCalendarEvent> = {}
): EconomicCalendarEvent {
    return {
        date: '2026-10-05 12:30:00',
        event: 'CPI YoY',
        impact: 'High',
        actual: null,
        estimate: null,
        previous: null,
        unit: '%',
        ...overrides,
    };
}

describe('planCalendarIngestion', () => {
    it('reads 30 days back and 30 days ahead for the US with no backfill', () => {
        expect(planCalendarIngestion('US', '2026-10-30')).toEqual({
            recent: { from: '2026-09-30', to: '2026-11-29' },
            backfill: null,
        });
    });

    it('reads the recent 30 days plus a 180-day backfill ending the day before for KR', () => {
        expect(planCalendarIngestion('KR', '2026-10-30')).toEqual({
            recent: { from: '2026-09-30', to: '2026-11-29' },
            backfill: { from: '2026-05-03', to: '2026-09-29' },
        });
    });
});

describe('dedupeCalendarEventsById', () => {
    it('keeps the later event when two share country, date and name', () => {
        const rows = dedupeCalendarEventsById('US', [
            event({ actual: 1 }),
            event({ actual: 2 }),
        ]);

        expect(rows).toHaveLength(1);
        expect(rows[0][1].actual).toBe(2);
    });

    it('pairs each event with its deterministic id', () => {
        const [row] = dedupeCalendarEventsById('KR', [event()]);

        expect(row[0]).toBe(
            economicCalendarId('KR', '2026-10-05 12:30:00', 'CPI YoY')
        );
    });

    it('keeps events that differ by name', () => {
        expect(
            dedupeCalendarEventsById('US', [
                event(),
                event({ event: 'Core CPI YoY' }),
            ])
        ).toHaveLength(2);
    });
});
