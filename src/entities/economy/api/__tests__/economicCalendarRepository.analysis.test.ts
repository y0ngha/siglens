vi.mock('server-only', () => ({}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DrizzleEconomicCalendarRepository } from '@/entities/economy/api/economicCalendarRepository';

/**
 * Chainable update/select stub returning the rows we hand it.
 *
 * select chain supports two terminal patterns:
 *  - `.from(...).where(...)` (used by listUnanalyzedAnnounced)
 *  - `.from(...).where(...).orderBy(...)` (used by listInRange)
 */
function makeDb(selectRows: unknown[]) {
    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));

    const orderBy = vi.fn(async () => selectRows);
    const selectWhere = vi.fn(() => ({
        orderBy,
        then: (resolve: (rows: unknown[]) => unknown) =>
            Promise.resolve(selectRows).then(resolve),
    }));
    const from = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from }));

    return {
        db: { update, select } as never,
        spies: { update, set, where, select, from, selectWhere, orderBy },
    };
}

describe('DrizzleEconomicCalendarRepository.attachEventAnalysis', () => {
    beforeEach(() => vi.clearAllMocks());

    it('updates the analysis columns guarded by analyzed_at IS NULL', async () => {
        const { db, spies } = makeDb([]);
        const repo = new DrizzleEconomicCalendarRepository(db);
        await repo.attachEventAnalysis('abc', {
            sentiment: 'bullish',
            summaryKo: '요약',
            interpretationKo: '해석',
        });
        expect(spies.update).toHaveBeenCalledOnce();
        const setArg = (
            spies.set.mock.calls as unknown as [[Record<string, unknown>]]
        )[0][0];
        expect(setArg.sentiment).toBe('bullish');
        expect(setArg.summaryKo).toBe('요약');
        expect(setArg.interpretationKo).toBe('해석');
        expect(setArg.analyzedAt).toBeInstanceOf(Date);
        expect(spies.where).toHaveBeenCalledOnce();
    });
});

describe('DrizzleEconomicCalendarRepository.listUnanalyzedAnnounced', () => {
    beforeEach(() => vi.clearAllMocks());

    it('maps rows to analyzer inputs (id + event fields)', async () => {
        const { db } = makeDb([
            {
                id: 'id1',
                dateEt: '2026-06-13 08:30:00',
                event: 'Core CPI MoM (May)',
                impact: 'High',
                actual: 0.4,
                estimate: 0.3,
                previous: 0.2,
                unit: '%',
            },
        ]);
        const repo = new DrizzleEconomicCalendarRepository(db);
        const rows = await repo.listUnanalyzedAnnounced(['High', 'Medium']);
        expect(rows).toEqual([
            {
                id: 'id1',
                event: 'Core CPI MoM (May)',
                impact: 'High',
                actual: 0.4,
                estimate: 0.3,
                previous: 0.2,
                unit: '%',
            },
        ]);
    });
});

describe('DrizzleEconomicCalendarRepository.listInRange (analysis columns)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('maps AI columns onto events and coerces unknown sentiment to null', async () => {
        const { db } = makeDb([
            {
                dateEt: '2026-06-13 08:30:00',
                event: 'Core CPI MoM (May)',
                impact: 'High',
                actual: 0.4,
                estimate: 0.3,
                previous: 0.2,
                unit: '%',
                sentiment: 'bearish',
                summaryKo: '요약',
                interpretationKo: '해석',
                analyzedAt: new Date('2026-06-13T13:00:00Z'),
            },
            {
                dateEt: '2026-06-14 10:00:00',
                event: 'Mystery',
                impact: 'Low',
                actual: null,
                estimate: null,
                previous: null,
                unit: '',
                sentiment: 'bogus',
                summaryKo: null,
                interpretationKo: null,
                analyzedAt: null,
            },
        ]);
        const repo = new DrizzleEconomicCalendarRepository(db);
        const events = await repo.listInRange('2026-06-01', '2026-06-30');
        expect(events[0].sentiment).toBe('bearish');
        expect(events[0].summaryKo).toBe('요약');
        expect(events[0].interpretationKo).toBe('해석');
        expect(events[1].sentiment).toBeNull(); // 'bogus' coerced
        expect(events[1].summaryKo).toBeNull();
    });
});
