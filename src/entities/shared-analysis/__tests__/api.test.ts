import type { Mock } from 'vitest';
import type { SiglensDatabase } from '@/shared/db/types';
import { DrizzleSharedAnalysisRepository } from '@/entities/shared-analysis/api';
import type { SharedAnalysisSnapshot } from '@/entities/shared-analysis/types';

const snapshot = {
    kind: 'chart',
    symbol: 'AAPL',
    context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity' },
    result: { trend: 'bullish' },
} as unknown as SharedAnalysisSnapshot;

function makeUpsertDb(returnedId: string): {
    db: SiglensDatabase;
    values: Mock;
} {
    const returning = vi.fn().mockResolvedValue([{ id: returnedId }]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    return { db: { insert } as unknown as SiglensDatabase, values };
}

function makeSelectDb(rows: unknown[]): SiglensDatabase {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { select } as unknown as SiglensDatabase;
}

describe('DrizzleSharedAnalysisRepository', () => {
    describe('create', () => {
        it('inserts and returns the id', async () => {
            const { db } = makeUpsertDb('abc123');
            const repo = new DrizzleSharedAnalysisRepository(db);
            const id = await repo.create({
                id: 'abc123',
                kind: 'chart',
                symbol: 'AAPL',
                contentHash: 'h',
                snapshot,
                sharerTier: 'free',
                userId: null,
                expiresAt: new Date('2026-07-06T00:00:00Z'),
            });
            expect(id).toBe('abc123');
        });

        /**
         * Addendum C-2: dedupe path — when onConflictDoUpdate returns an
         * existing id (the INSERT conflicts on contentHash and Postgres returns
         * the already-stored row id), create() must forward that existing id.
         */
        it('returns the existing id when onConflictDoUpdate resolves with a pre-existing row', async () => {
            const { db } = makeUpsertDb('existing');
            const repo = new DrizzleSharedAnalysisRepository(db);
            const id = await repo.create({
                id: 'new-generated-id',
                kind: 'chart',
                symbol: 'AAPL',
                contentHash: 'h',
                snapshot,
                sharerTier: 'free',
                userId: null,
                expiresAt: new Date('2026-07-06T00:00:00Z'),
            });
            // The returning mock yields [{ id: 'existing' }], so create() must
            // return 'existing', not the id field on the record.
            expect(id).toBe('existing');
        });
    });

    describe('findById', () => {
        it('returns the row when present', async () => {
            const db = makeSelectDb([
                {
                    snapshotJson: snapshot,
                    createdAt: new Date(),
                    expiresAt: new Date('2026-07-06T00:00:00Z'),
                },
            ]);
            const repo = new DrizzleSharedAnalysisRepository(db);
            const row = await repo.findById('abc123');
            expect(row).not.toBeNull();
        });

        it('returns null when absent', async () => {
            const repo = new DrizzleSharedAnalysisRepository(makeSelectDb([]));
            expect(await repo.findById('nope')).toBeNull();
        });
    });
});
