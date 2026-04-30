jest.mock('@y0ngha/siglens-core', () => ({
    createDatabaseClient: jest.fn(),
}));

import { createDatabaseClient } from '@y0ngha/siglens-core';
import {
    getAuthDatabaseClient,
    resetAuthDatabaseClientForTests,
} from '@/infrastructure/auth/db';

const mockCreate = createDatabaseClient as jest.MockedFunction<
    typeof createDatabaseClient
>;
const FAKE_CLIENT = { db: {}, sql: () => null } as unknown as ReturnType<
    typeof createDatabaseClient
>;

describe('getAuthDatabaseClient', () => {
    const originalEnv = process.env.DATABASE_URL;

    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        mockCreate.mockReset();
        mockCreate.mockReturnValue(FAKE_CLIENT);
        process.env.DATABASE_URL = 'postgres://test';
    });

    afterEach(() => {
        process.env.DATABASE_URL = originalEnv;
    });

    it('첫 호출 시 createDatabaseClient를 호출하고 결과를 반환한다', () => {
        const result = getAuthDatabaseClient();
        expect(result).toBe(FAKE_CLIENT);
        expect(mockCreate).toHaveBeenCalledWith({
            databaseUrl: 'postgres://test',
        });
    });

    it('이후 호출은 캐시된 동일 인스턴스를 반환한다', () => {
        const first = getAuthDatabaseClient();
        const second = getAuthDatabaseClient();
        expect(second).toBe(first);
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('DATABASE_URL이 비어 있으면 throw한다', () => {
        delete process.env.DATABASE_URL;
        expect(() => getAuthDatabaseClient()).toThrow(
            'DATABASE_URL is not configured'
        );
    });
});
