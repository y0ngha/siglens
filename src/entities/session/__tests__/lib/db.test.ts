import { vi, type MockedFunction } from 'vitest';
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(),
    resetDatabaseClientForTests: vi.fn(),
}));

import {
    getDatabaseClient,
    resetDatabaseClientForTests,
} from '@/shared/db/client';
import {
    getAuthDatabaseClient,
    resetAuthDatabaseClientForTests,
} from '@/entities/session/lib/db';

const mockGet = getDatabaseClient as MockedFunction<typeof getDatabaseClient>;
const mockReset = resetDatabaseClientForTests as MockedFunction<
    typeof resetDatabaseClientForTests
>;

const FAKE_CLIENT = { db: {}, sql: () => null } as unknown as ReturnType<
    typeof getDatabaseClient
>;

describe('getAuthDatabaseClient', () => {
    beforeEach(() => {
        mockGet.mockReset();
        mockReset.mockReset();
        mockGet.mockReturnValue(FAKE_CLIENT);
    });

    it('delegates to the shared getDatabaseClient and returns the result', () => {
        const result = getAuthDatabaseClient();
        expect(result).toBe(FAKE_CLIENT);
        expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('propagates errors thrown by the shared getDatabaseClient', () => {
        mockGet.mockImplementation(() => {
            throw new Error('DATABASE_URL environment variable is required');
        });
        expect(() => getAuthDatabaseClient()).toThrow(
            'DATABASE_URL environment variable is required'
        );
    });

    it('forwards reset calls to the shared module', () => {
        resetAuthDatabaseClientForTests();
        expect(mockReset).toHaveBeenCalledTimes(1);
    });
});
