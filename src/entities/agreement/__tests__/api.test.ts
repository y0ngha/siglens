vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));
import { DrizzleAgreementRepository } from '@/entities/agreement/api';
import type { SiglensDatabase } from '@/shared/db/types';

describe('DrizzleAgreementRepository', () => {
    it('inserts multiple agreement rows', async () => {
        const valuesMock = vi.fn().mockResolvedValue(undefined);
        const insert = vi.fn().mockReturnValue({ values: valuesMock });
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
            insert: vi.fn(),
        } as unknown as SiglensDatabase;
        const repo = new DrizzleAgreementRepository(db);

        await expect(repo.insertMany([])).rejects.toThrow(
            'agreement input must not be empty'
        );
    });

    it('maps each input to exactly the four persisted columns', async () => {
        const valuesMock = vi.fn().mockResolvedValue(undefined);
        const db = {
            insert: vi.fn().mockReturnValue({ values: valuesMock }),
        } as unknown as SiglensDatabase;
        const at = new Date('2026-05-04T00:00:00Z');

        await new DrizzleAgreementRepository(db).insertMany([
            { userId: 'u1', termsId: 't1', agreed: false, agreedAt: at },
        ]);

        expect(valuesMock.mock.calls[0][0]).toStrictEqual([
            { userId: 'u1', termsId: 't1', agreed: false, agreedAt: at },
        ]);
    });

    it('retries a transient failure and then succeeds', async () => {
        const transient = Object.assign(new Error('CONNECTION_CLOSED'), {
            code: 'CONNECTION_CLOSED',
        });
        const valuesMock = vi
            .fn()
            .mockRejectedValueOnce(transient)
            .mockResolvedValueOnce(undefined);
        const db = {
            insert: vi.fn().mockReturnValue({ values: valuesMock }),
        } as unknown as SiglensDatabase;

        await new DrizzleAgreementRepository(db).insertMany([
            { userId: 'u1', termsId: 't1', agreed: true, agreedAt: new Date() },
        ]);

        expect(valuesMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry a non-transient failure', async () => {
        const valuesMock = vi.fn().mockRejectedValue(new Error('unique'));
        const db = {
            insert: vi.fn().mockReturnValue({ values: valuesMock }),
        } as unknown as SiglensDatabase;

        await expect(
            new DrizzleAgreementRepository(db).insertMany([
                {
                    userId: 'u1',
                    termsId: 't1',
                    agreed: true,
                    agreedAt: new Date(),
                },
            ])
        ).rejects.toThrow('unique');
        expect(valuesMock).toHaveBeenCalledTimes(1);
    });
});
