vi.mock('server-only', () => ({}));

/**
 * drizzle-orm의 gte/lte를 spy로 래핑해 listInRange 경계 계약을 단언한다.
 * ESM namespace는 vi.spyOn 불가 — vi.mock 팩토리에서 래핑한다.
 * and/asc/sql은 실제 구현을 그대로 사용해 쿼리 빌더 체인 동작을 보존한다.
 */
const gteSpy = vi.fn();
const lteSpy = vi.fn();
const eqSpy = vi.fn();
vi.mock('drizzle-orm', async importOriginal => {
    const original = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...original,
        gte: (...args: Parameters<typeof original.gte>) => {
            gteSpy(...args);
            return original.gte(...args);
        },
        lte: (...args: Parameters<typeof original.lte>) => {
            lteSpy(...args);
            return original.lte(...args);
        },
        eq: (...args: Parameters<typeof original.eq>) => {
            eqSpy(...args);
            return original.eq(...args);
        },
    };
});

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
    // `listUnanalyzedAnnounced`는 한 pass의 LLM 왕복 수를 `.limit()`으로 묶는다.
    const limit = vi.fn(async () => selectRows);
    const where = vi.fn(() => ({ orderBy, limit }));
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
            limit,
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

    it('queries with inclusive lower bound and upper bound extended to 23:59:59', async () => {
        const { db } = makeDb([], []);
        const repo = new DrizzleEconomicCalendarRepository(db);
        await repo.listInRange('2026-06-01', '2026-06-30', 'US');
        // gte 두 번째 인수는 fromEt 그대로 (하한 경계 포함)
        expect(gteSpy).toHaveBeenCalledWith(expect.anything(), '2026-06-01');
        // lte 두 번째 인수는 toEt + ' 23:59:59' (같은 날 이벤트 누락 방지)
        expect(lteSpy).toHaveBeenCalledWith(
            expect.anything(),
            '2026-06-30 23:59:59'
        );
    });

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
                    sentiment: null,
                    summaryKo: null,
                    interpretationKo: null,
                    analyzedAt: null,
                },
                {
                    dateEt: '2026-06-14 10:00:00',
                    event: 'Mystery',
                    impact: 'bogus',
                    actual: null,
                    estimate: null,
                    previous: null,
                    unit: '',
                    sentiment: null,
                    summaryKo: null,
                    interpretationKo: null,
                    analyzedAt: null,
                },
            ]
        );
        const repo = new DrizzleEconomicCalendarRepository(db);
        const events = await repo.listInRange('2026-06-01', '2026-06-30', 'US');
        expect(events).toHaveLength(2);
        expect(events[0]).toEqual({
            date: '2026-06-13 08:30:00',
            event: 'Core CPI MoM (May)',
            impact: 'High',
            actual: 0.4,
            estimate: 0.3,
            previous: 0.2,
            unit: '%',
            sentiment: null,
            summaryKo: null,
            interpretationKo: null,
            analyzedAt: null,
        });
        expect(events[1]).toEqual({
            date: '2026-06-14 10:00:00',
            event: 'Mystery',
            impact: 'Low',
            actual: null,
            estimate: null,
            previous: null,
            unit: '',
            sentiment: null,
            summaryKo: null,
            interpretationKo: null,
            analyzedAt: null,
        });
    });
});

/**
 * 한국 지표 카드는 FMP 지표 시계열이 KR을 커버하지 않아 캘린더 발표 이력에서
 * 값을 되짚는다. 국가 필터가 빠지면 미국 CPI가 한국 카드에 섞여 들어오는데,
 * 화면상으로는 그냥 "값이 이상한 카드"로만 보인다.
 */
describe('DrizzleEconomicCalendarRepository.listAnnouncedSince', () => {
    beforeEach(() => vi.clearAllMocks());

    const ROWS = [
        {
            dateEt: '2026-08-01',
            event: 'BOK Interest Rate Decision',
            actual: 2.75,
            previous: 2.75,
            unit: '%',
        },
        {
            dateEt: '2026-08-05',
            event: 'CPI YoY',
            actual: null,
            previous: 2.7,
            unit: '%',
        },
    ];

    it('국가와 시작일로 거른다', async () => {
        const { db, spies } = makeDb([], ROWS);
        const repo = new DrizzleEconomicCalendarRepository(db);

        await repo.listAnnouncedSince('KR', '2026-01-01');

        expect(spies.select).toHaveBeenCalledOnce();
        expect(eqSpy).toHaveBeenCalledWith(expect.anything(), 'KR');
        expect(gteSpy).toHaveBeenCalledWith(expect.anything(), '2026-01-01');
    });

    it('actual이 null인 행은 결과에서 빠진다', async () => {
        const { db } = makeDb([], ROWS);
        const repo = new DrizzleEconomicCalendarRepository(db);

        const points = await repo.listAnnouncedSince('KR', '2026-01-01');

        expect(points).toEqual([
            {
                dateEt: '2026-08-01',
                event: 'BOK Interest Rate Decision',
                actual: 2.75,
                previous: 2.75,
                unit: '%',
            },
        ]);
    });

    it('행이 없으면 빈 배열을 돌려준다', async () => {
        const { db } = makeDb([], []);
        const repo = new DrizzleEconomicCalendarRepository(db);

        expect(await repo.listAnnouncedSince('KR', '2026-01-01')).toEqual([]);
    });
});

/**
 * 국가 필터가 빠지면 `/economy`와 `/economy/kr`이 같은 병합 캘린더를 그린다.
 * `listUnanalyzedAnnounced` 쪽이 더 나쁘다 — 미국 방문이 KR 이벤트를 집어다
 * 미국 few-shot 프롬프트로 분석하고, `analyzed_at IS NULL` 가드 때문에
 * **한 번 쓰면 못 고친다.**
 */
describe('국가 필터', () => {
    beforeEach(() => vi.clearAllMocks());

    it('listInRange가 국가로 거른다', async () => {
        const { db } = makeDb([], []);
        const repo = new DrizzleEconomicCalendarRepository(db);

        await repo.listInRange('2026-06-01', '2026-06-30', 'KR');

        expect(eqSpy).toHaveBeenCalledWith(expect.anything(), 'KR');
    });

    it('listUnanalyzedAnnounced가 국가로 거른다', async () => {
        const { db } = makeDb([], []);
        const repo = new DrizzleEconomicCalendarRepository(db);

        await repo.listUnanalyzedAnnounced(['High'], 'KR');

        expect(eqSpy).toHaveBeenCalledWith(expect.anything(), 'KR');
    });
});
