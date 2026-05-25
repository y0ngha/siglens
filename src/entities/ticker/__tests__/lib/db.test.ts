import type { MockedFunction } from 'vitest';
vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: vi.fn(),
    resetDatabaseClientForTests: vi.fn(),
}));

import {
    resetDatabaseClientForTests,
    tryGetDatabaseClient,
} from '@/shared/db/client';
import {
    resetTickerDatabaseClientForTests,
    tryGetTickerDatabaseClient,
} from '../../lib/db';

const mockTryGet = tryGetDatabaseClient as MockedFunction<
    typeof tryGetDatabaseClient
>;
const mockReset = resetDatabaseClientForTests as MockedFunction<
    typeof resetDatabaseClientForTests
>;

const fakeClient = {
    db: {} as never,
    sql: (() => null) as never,
};

describe('tryGetTickerDatabaseClient', () => {
    beforeEach(() => {
        mockTryGet.mockReset();
        mockReset.mockReset();
    });

    it('returns null when the shared helper returns null', () => {
        mockTryGet.mockReturnValue(null);
        expect(tryGetTickerDatabaseClient()).toBeNull();
    });

    it('delegates to the shared tryGetDatabaseClient', () => {
        mockTryGet.mockReturnValue(fakeClient);
        const client = tryGetTickerDatabaseClient();
        expect(client).toBe(fakeClient);
        expect(mockTryGet).toHaveBeenCalledTimes(1);
    });

    it('forwards reset calls to the shared module', () => {
        resetTickerDatabaseClientForTests();
        expect(mockReset).toHaveBeenCalledTimes(1);
    });
});
