vi.mock('server-only', () => ({}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { IndicatorTranslationRecord } from '@/shared/db/types';
import { DrizzleIndicatorTranslationRepository } from '@/entities/economy/api/indicatorTranslationRepository';

/** Chainable select/from/where + insert/values/onConflictDoUpdate stub. */
function makeDb(selectRows: unknown[]) {
    const where = vi.fn(async () => selectRows);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    const onConflictDoUpdate = vi.fn(async () => undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));

    return {
        db: { select, insert } as never,
        spies: { select, from, where, insert, values, onConflictDoUpdate },
    };
}

const RECORD: IndicatorTranslationRecord = {
    normalizedName: 'Some Obscure Index YoY',
    koreanName: '어떤 모호한 지수(전년比)',
    source: 'ai',
};

describe('DrizzleIndicatorTranslationRepository.findByNames', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns [] without querying when names is empty', async () => {
        const { db, spies } = makeDb([]);
        const repo = new DrizzleIndicatorTranslationRepository(db);
        const rows = await repo.findByNames([]);
        expect(rows).toEqual([]);
        expect(spies.select).not.toHaveBeenCalled();
    });

    it('maps DB rows to IndicatorTranslationRecord', async () => {
        const { db } = makeDb([
            {
                normalizedName: 'Nonfarm Payrolls',
                koreanName: '비농업 고용',
                source: 'ai',
            },
        ]);
        const repo = new DrizzleIndicatorTranslationRepository(db);
        const rows = await repo.findByNames(['Nonfarm Payrolls']);
        expect(rows).toEqual([
            {
                normalizedName: 'Nonfarm Payrolls',
                koreanName: '비농업 고용',
                source: 'ai',
            },
        ]);
    });
});

describe('DrizzleIndicatorTranslationRepository.upsert', () => {
    beforeEach(() => vi.clearAllMocks());

    it('inserts with the normalized name, korean name, and source', async () => {
        const { db, spies } = makeDb([]);
        const repo = new DrizzleIndicatorTranslationRepository(db);
        await repo.upsert(RECORD);
        expect(spies.insert).toHaveBeenCalledOnce();
        const inserted = spies.values.mock.calls[0][0] as Record<
            string,
            unknown
        >;
        expect(inserted.normalizedName).toBe('Some Obscure Index YoY');
        expect(inserted.koreanName).toBe('어떤 모호한 지수(전년比)');
        expect(inserted.source).toBe('ai');
        expect(spies.onConflictDoUpdate).toHaveBeenCalledOnce();
    });
});
