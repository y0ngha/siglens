vi.mock('postgres', () => ({
    default: vi.fn(() => vi.fn()),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
    drizzle: vi.fn(() => ({})),
}));

vi.mock('@/shared/db/schema', () => ({}));

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { createTestDatabaseClient } from '@/shared/db/clientTest';

describe('createTestDatabaseClient', () => {
    beforeEach(() => {
        vi.mocked(postgres).mockReturnValue(vi.fn() as never);
        vi.mocked(drizzle).mockReturnValue({} as never);
    });

    it('postgres와 drizzle을 호출하고 db, sql 프로퍼티를 가진 객체를 반환한다', () => {
        const mockSql = vi.fn();
        const mockDb = { tables: true };
        vi.mocked(postgres).mockReturnValue(mockSql as never);
        vi.mocked(drizzle).mockReturnValue(mockDb as never);

        const client = createTestDatabaseClient({
            databaseUrl: 'postgres://x',
        });

        expect(postgres).toHaveBeenCalledWith('postgres://x', { max: 4 });
        expect(drizzle).toHaveBeenCalledWith(mockSql, expect.any(Object));
        expect(client).toHaveProperty('db', mockDb);
        expect(client).toHaveProperty('sql', mockSql);
    });
});
