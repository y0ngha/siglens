jest.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: jest.fn(),
    resetDatabaseClientForTests: jest.fn(),
}));

import {
    resetDatabaseClientForTests,
    tryGetDatabaseClient,
} from '@/shared/db/client';
import {
    resetTickerDatabaseClientForTests,
    tryGetTickerDatabaseClient,
} from '@/infrastructure/ticker/db';

const mockTryGet = tryGetDatabaseClient as jest.MockedFunction<
    typeof tryGetDatabaseClient
>;
const mockReset = resetDatabaseClientForTests as jest.MockedFunction<
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
