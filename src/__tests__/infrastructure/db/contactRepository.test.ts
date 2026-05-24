import { inquiries } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import {
    DrizzleContactRepository,
    type ContactInput,
} from '@/infrastructure/db/contactRepository';

function makeInsertDb(): {
    db: SiglensDatabase;
    insert: jest.Mock;
    values: jest.Mock;
} {
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn(() => ({ values }));

    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
        values,
    };
}

const validInput: ContactInput = {
    title: 'Test inquiry',
    content: 'Test content body',
    email: 'visitor@example.com',
};

describe('DrizzleContactRepository', () => {
    describe('create', () => {
        it('inserts the inquiry into the database with explicit fields', async () => {
            const { db, insert, values } = makeInsertDb();
            const repository = new DrizzleContactRepository(db);

            await repository.create(validInput);

            expect(insert).toHaveBeenCalledWith(inquiries);
            expect(values).toHaveBeenCalledWith({
                title: 'Test inquiry',
                content: 'Test content body',
                email: 'visitor@example.com',
            });
        });

        it('propagates database errors to the caller', async () => {
            const dbError = new Error('db connection lost');
            const values = jest.fn().mockRejectedValue(dbError);
            const insert = jest.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;
            const repository = new DrizzleContactRepository(db);

            await expect(repository.create(validInput)).rejects.toThrow(
                'db connection lost'
            );
        });
    });
});
