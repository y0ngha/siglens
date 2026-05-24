import { DrizzleAgreementRepository } from '@/infrastructure/db/agreementRepository';
import type { SiglensDatabase } from '@/shared/db/types';

describe('DrizzleAgreementRepository', () => {
    it('inserts multiple agreement rows', async () => {
        const valuesMock = jest.fn().mockResolvedValue(undefined);
        const insert = jest.fn().mockReturnValue({ values: valuesMock });
        const db = { insert } as unknown as SiglensDatabase;
        const repo = new DrizzleAgreementRepository(db);

        const now = new Date('2026-05-04T00:00:00Z');
        await repo.insertMany([
            {
                userId: 'u1',
                termsId: 't1',
                agreed: true,
                agreedAt: now,
            },
            {
                userId: 'u1',
                termsId: 't2',
                agreed: true,
                agreedAt: now,
            },
        ]);

        expect(insert).toHaveBeenCalledTimes(1);
        expect(valuesMock).toHaveBeenCalledWith([
            expect.objectContaining({
                userId: 'u1',
                termsId: 't1',
                agreed: true,
            }),
            expect.objectContaining({
                userId: 'u1',
                termsId: 't2',
                agreed: true,
            }),
        ]);
    });

    it('throws if input array is empty', async () => {
        const db = {
            insert: jest.fn(),
        } as unknown as SiglensDatabase;
        const repo = new DrizzleAgreementRepository(db);

        await expect(repo.insertMany([])).rejects.toThrow(
            'agreement input must not be empty'
        );
    });
});
