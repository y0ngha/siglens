vi.mock('@neondatabase/serverless', () => ({
    neon: vi.fn(() => vi.fn()),
}));

vi.mock('drizzle-orm/neon-http', () => ({
    drizzle: vi.fn(() => ({})),
}));

vi.mock('@/shared/db/config', () => ({
    readDatabaseConfig: vi.fn(() => ({ databaseUrl: 'postgres://test' })),
    tryReadDatabaseConfig: vi.fn(() => ({ databaseUrl: 'postgres://test' })),
}));

vi.mock('@/shared/db/schema', () => ({}));

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { readDatabaseConfig, tryReadDatabaseConfig } from '@/shared/db/config';
import {
    createDatabaseClient,
    getDatabaseClient,
    resetDatabaseClientForTests,
    tryGetDatabaseClient,
} from '@/shared/db/client';

describe('createDatabaseClient', () => {
    beforeEach(() => {
        vi.mocked(neon).mockReturnValue(vi.fn() as never);
        vi.mocked(drizzle).mockReturnValue({} as never);
    });

    it('neon과 drizzle을 호출하고 db, sql 프로퍼티를 가진 객체를 반환한다', () => {
        const mockSql = vi.fn();
        const mockDb = { tables: true };
        vi.mocked(neon).mockReturnValue(mockSql as never);
        vi.mocked(drizzle).mockReturnValue(mockDb as never);

        const client = createDatabaseClient({
            databaseUrl: 'postgres://test-url',
        });

        expect(neon).toHaveBeenCalledWith('postgres://test-url');
        expect(drizzle).toHaveBeenCalledWith(mockSql, expect.any(Object));
        expect(client).toHaveProperty('db', mockDb);
        expect(client).toHaveProperty('sql', mockSql);
    });
});

describe('getDatabaseClient', () => {
    beforeEach(() => {
        resetDatabaseClientForTests();
        vi.mocked(neon).mockReturnValue(vi.fn() as never);
        vi.mocked(drizzle).mockReturnValue({} as never);
    });

    it('DatabaseClient를 반환한다', () => {
        const client = getDatabaseClient();
        expect(client).toHaveProperty('db');
        expect(client).toHaveProperty('sql');
    });

    it('두 번 호출해도 같은 캐시된 인스턴스를 반환한다', () => {
        const first = getDatabaseClient();
        vi.mocked(readDatabaseConfig).mockClear();
        const second = getDatabaseClient();
        expect(first).toBe(second);
        // 캐시 히트이므로 readDatabaseConfig가 다시 호출되지 않아야 한다.
        expect(readDatabaseConfig).not.toHaveBeenCalled();
    });

    it('resetDatabaseClientForTests 후에는 새 인스턴스를 생성한다', () => {
        const first = getDatabaseClient();
        resetDatabaseClientForTests();
        const second = getDatabaseClient();
        expect(first).not.toBe(second);
    });
});

describe('tryGetDatabaseClient', () => {
    beforeEach(() => {
        resetDatabaseClientForTests();
        vi.mocked(neon).mockReturnValue(vi.fn() as never);
        vi.mocked(drizzle).mockReturnValue({} as never);
    });

    it('config가 존재하면 DatabaseClient를 반환한다', () => {
        vi.mocked(tryReadDatabaseConfig).mockReturnValue({
            databaseUrl: 'postgres://test',
        });
        const client = tryGetDatabaseClient();
        expect(client).not.toBeNull();
        expect(client).toHaveProperty('db');
        expect(client).toHaveProperty('sql');
    });

    it('config가 null이면 null을 반환한다', () => {
        vi.mocked(tryReadDatabaseConfig).mockReturnValue(null);
        const client = tryGetDatabaseClient();
        expect(client).toBeNull();
    });
});
