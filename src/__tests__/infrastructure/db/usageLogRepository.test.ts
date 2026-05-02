import { usageLogs } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import { DrizzleUsageLogRepository } from '@/infrastructure/db/usageLogRepository';

function makeInsertDb(): {
    db: SiglensDatabase;
    insert: ReturnType<typeof jest.fn>;
    values: ReturnType<typeof jest.fn>;
} {
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn(() => ({ values }));

    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
        values,
    };
}

describe('DrizzleUsageLogRepository', () => {
    it('records a usage log row', async () => {
        const { db, insert, values } = makeInsertDb();
        const repository = new DrizzleUsageLogRepository(db);

        await repository.recordUsage({
            userId: 'user-1',
            ipHash: 'hashed-ip',
            actionType: 'premium_model',
            modelUsed: 'gemini-2.5-pro',
            date: '2026-04-28',
        });

        expect(insert).toHaveBeenCalledWith(usageLogs);
        expect(values).toHaveBeenCalledWith({
            userId: 'user-1',
            ipHash: 'hashed-ip',
            actionType: 'premium_model',
            modelUsed: 'gemini-2.5-pro',
            date: '2026-04-28',
        });
    });
});
