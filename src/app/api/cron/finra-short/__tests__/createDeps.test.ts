const { mockClient, mockRevalidate, mockRevalidateReadiness } = vi.hoisted(
    () => ({
        mockClient: vi.fn(),
        mockRevalidate: vi.fn(),
        mockRevalidateReadiness: vi.fn(),
    })
);
vi.mock('../../revalidateSymbols', () => ({
    revalidateSymbols: mockRevalidate,
}));
vi.mock('../../revalidateFlowsReadiness', () => ({
    revalidateFlowsReadiness: mockRevalidateReadiness,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: mockClient }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFinraShortDeps } from '../createDeps';

describe('createFinraShortDeps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws when the database is unavailable', () => {
        mockClient.mockReturnValue(null);
        expect(() => createFinraShortDeps(() => false)).toThrow(
            '[finra-short] database unavailable'
        );
    });

    it('wires cache invalidation to the symbol tag helper', () => {
        mockClient.mockReturnValue({ db: {} });
        createFinraShortDeps(() => false).invalidateSymbols(['AAPL']);
        expect(mockRevalidate).toHaveBeenCalledWith(['AAPL']);
    });

    it('wires the first-data hook to the readiness-cache invalidation', () => {
        mockClient.mockReturnValue({ db: {} });
        createFinraShortDeps(() => false).onFirstDataStored?.();
        expect(mockRevalidateReadiness).toHaveBeenCalledTimes(1);
    });
});
