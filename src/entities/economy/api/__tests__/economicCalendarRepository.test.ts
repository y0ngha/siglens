vi.mock('server-only', () => ({}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import { DrizzleEconomicCalendarRepository } from '@/entities/economy/api/economicCalendarRepository';

const EVENT: EconomicCalendarEvent = {
    date: '2026-06-13 08:30:00',
    event: 'Core CPI MoM (May)',
    impact: 'High',
    actual: null,
    estimate: 0.3,
    previous: 0.2,
    unit: '%',
};

/** Minimal chainable insert/onConflict/returning + select/from/where/orderBy stub. */
function makeDb(returningRows: { id: string }[], selectRows: unknown[]) {
    const returning = vi.fn(async () => returningRows);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));

    const orderBy = vi.fn(async () => selectRows);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    return {
        db: { insert, select } as never,
        spies: {
            insert,
            values,
            onConflictDoUpdate,
            returning,
            select,
            from,
            where,
            orderBy,
        },
    };
}

describe('DrizzleEconomicCalendarRepository.upsertEvent', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns true when a row was inserted or changed', async () => {
        const { db, spies } = makeDb([{ id: 'abc' }], []);
        const repo = new DrizzleEconomicCalendarRepository(db);
        const changed = await repo.upsertEvent('US', EVENT);
        expect(changed).toBe(true);
        expect(spies.insert).toHaveBeenCalledOnce();
        expect(spies.onConflictDoUpdate).toHaveBeenCalledOnce();
    });

    it('returns false when the upsert touched no rows', async () => {
        const { db } = makeDb([], []);
        const repo = new DrizzleEconomicCalendarRepository(db);
        const changed = await repo.upsertEvent('US', EVENT);
        expect(changed).toBe(false);
    });

    it('inserts with the deterministic id, country, and dateEt = FMP date', async () => {
        const { db, spies } = makeDb([{ id: 'abc' }], []);
        const repo = new DrizzleEconomicCalendarRepository(db);
        await repo.upsertEvent('US', EVENT);
        const firstCall = spies.values.mock.calls[0] as unknown[];
        const inserted = firstCall[0] as Record<string, unknown>;
        expect(inserted.country).toBe('US');
        expect(inserted.dateEt).toBe('2026-06-13 08:30:00');
        expect(inserted.event).toBe('Core CPI MoM (May)');
        expect(inserted.impact).toBe('High');
        expect(typeof inserted.id).toBe('string');
        expect(inserted.id).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('DrizzleEconomicCalendarRepository.listInRange', () => {
    beforeEach(() => vi.clearAllMocks());

    it('maps DB rows to EconomicCalendarEvent and coerces unknown impact to Low', async () => {
        const { db } = makeDb(
            [],
            [
                {
                    dateEt: '2026-06-13 08:30:00',
                    event: 'Core CPI MoM (May)',
                    impact: 'High',
                    actual: 0.4,
                    estimate: 0.3,
                    previous: 0.2,
                    unit: '%',
                },
                {
                    dateEt: '2026-06-14 10:00:00',
                    event: 'Mystery',
                    impact: 'bogus',
                    actual: null,
                    estimate: null,
                    previous: null,
                    unit: '',
                },
            ]
        );
        const repo = new DrizzleEconomicCalendarRepository(db);
        const events = await repo.listInRange('2026-06-01', '2026-06-30');
        expect(events).toHaveLength(2);
        expect(events[0]).toEqual({
            date: '2026-06-13 08:30:00',
            event: 'Core CPI MoM (May)',
            impact: 'High',
            actual: 0.4,
            estimate: 0.3,
            previous: 0.2,
            unit: '%',
        });
        expect(events[1].impact).toBe('Low');
    });
});
