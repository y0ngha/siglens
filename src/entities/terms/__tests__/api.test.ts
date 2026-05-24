// withRetry 내부 sleep을 즉시 resolve로 stubbing해서 transient retry 케이스의
// 실제 대기 시간을 없앤다. `jest.mock` 은 정적 import 보다 먼저 평가되도록
// 호이스트되어야 한다 (`import/first` 규칙과 일치).
jest.mock('@/shared/lib/sleep', () => ({
    sleep: jest.fn().mockResolvedValue(undefined),
}));

import { DrizzleTermsRepository } from '@/entities/terms';
import type { SiglensDatabase } from '@/shared/db/types';
import type { TermsKind } from '@/shared/db/constants';

interface InsertedRow {
    id: string;
    kind: TermsKind;
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

    // upsertFromSeed 가 NEON_TRANSIENT_RETRY 정책을 실제로 통과시키는지 확인하는
    // smoke 테스트. withRetry/isNeonTransientError 자체 동작은 각자의 단위
    // 테스트에서 검증하므로 여기서는 "정책이 wire-up 됐다"만 보장한다.
    describe('Neon transient retry wire-up', () => {
        const seedInput = {
            kind: 'privacy' as TermsKind,
            version: 1,
            effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
            body: '## body',
        };

        it('transient NeonDbError 가 발생하면 재시도해 결국 성공한다', async () => {
            const neonTransient = Object.assign(
                new Error('Error connecting to database: fetch failed'),
                { name: 'NeonDbError' }
            );
            const onConflictDoNothing = jest
                .fn()
                .mockRejectedValueOnce(neonTransient)
                .mockResolvedValueOnce(undefined);
            const values = jest.fn(() => ({ onConflictDoNothing }));
            const insert = jest.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;
            const repo = new DrizzleTermsRepository(db);

            await expect(
                repo.upsertFromSeed(seedInput)
            ).resolves.toBeUndefined();
            expect(insert).toHaveBeenCalledTimes(2);
            expect(onConflictDoNothing).toHaveBeenCalledTimes(2);
        });

        it('non-transient 에러는 재시도 없이 즉시 전파한다', async () => {
            const constraintError = Object.assign(
                new Error(
                    'duplicate key value violates unique constraint "terms_kind_version_unique"'
                ),
                { name: 'NeonDbError' }
            );
            const onConflictDoNothing = jest
                .fn()
                .mockRejectedValueOnce(constraintError);
            const values = jest.fn(() => ({ onConflictDoNothing }));
            const insert = jest.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;
            const repo = new DrizzleTermsRepository(db);

            await expect(repo.upsertFromSeed(seedInput)).rejects.toBe(
                constraintError
            );
            expect(insert).toHaveBeenCalledTimes(1);
        });
    });
});
