import { DrizzleTermsRepository } from '@/infrastructure/db/termsRepository';
import type { SiglensDatabase } from '@/infrastructure/db/types';

interface InsertedRow {
    id: string;
    kind: 'privacy' | 'tos';
    version: number;
    effectiveDate: Date;
    body: string;
}

function makeMockDb(rows: InsertedRow[]): SiglensDatabase {
    const builder = {
        from: () => builder,
        where: () => builder,
        orderBy: () => builder,
        limit: (n: number) => Promise.resolve(rows.slice(0, n)),
    };
    return {
        select: () => builder,
        insert: () => ({
            values: () => ({
                onConflictDoNothing: () => Promise.resolve(),
            }),
        }),
    } as unknown as SiglensDatabase;
}

describe('DrizzleTermsRepository', () => {
    describe('findActive', () => {
        it('returns the latest effective version for the given kind', async () => {
            const effectiveDate = new Date('2026-04-30T00:00:00+09:00');
            const db = makeMockDb([
                {
                    id: 't1',
                    kind: 'privacy',
                    version: 2,
                    effectiveDate,
                    body: '## v2 body',
                },
            ]);
            const repo = new DrizzleTermsRepository(db);

            const result = await repo.findActive('privacy');

            expect(result).not.toBeNull();
            expect(result?.kind).toBe('privacy');
            expect(result?.version).toBe(2);
            expect(result?.effectiveDate).toEqual(effectiveDate);
        });

        it('returns null when no active version exists', async () => {
            const db = makeMockDb([]);
            const repo = new DrizzleTermsRepository(db);

            const result = await repo.findActive('tos');

            expect(result).toBeNull();
        });
    });

    describe('upsertFromSeed', () => {
        it('calls insert with onConflictDoNothing', async () => {
            const onConflict = jest.fn().mockResolvedValue(undefined);
            const values = jest.fn().mockReturnValue({
                onConflictDoNothing: onConflict,
            });
            const insert = jest.fn().mockReturnValue({ values });
            const db = { insert } as unknown as SiglensDatabase;
            const repo = new DrizzleTermsRepository(db);

            await repo.upsertFromSeed({
                kind: 'privacy',
                version: 1,
                effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
                body: '## body',
            });

            expect(insert).toHaveBeenCalledTimes(1);
            expect(values).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: 'privacy',
                    version: 1,
                    body: '## body',
                })
            );
            expect(onConflict).toHaveBeenCalled();
        });
    });
});
