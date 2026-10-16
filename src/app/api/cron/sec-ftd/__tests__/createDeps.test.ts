const { mockClient, mockRevalidate } = vi.hoisted(() => ({
    mockClient: vi.fn(),
    mockRevalidate: vi.fn(),
}));
vi.mock('../../revalidateSymbols', () => ({
    revalidateSymbols: mockRevalidate,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: mockClient }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    fetchFailsToDeliverListing,
    fetchSecFile,
    isSecBlockedError,
} from '@/shared/api/sec/secClient';
import { createSecFtdDeps } from '../createDeps';

describe('createSecFtdDeps', () => {
    beforeEach(() => {
        mockClient.mockReset();
    });

    it('throws when the database is unavailable (the cron logs "run failed")', () => {
        mockClient.mockReturnValue(null);
        expect(() => createSecFtdDeps(() => false)).toThrow(
            '[sec-ftd] database unavailable'
        );
    });

    it('wires the SEC file client, the shared block detector and the deadline', () => {
        mockClient.mockReturnValue({ db: {} });
        const isDeadlineReached = () => true;
        const deps = createSecFtdDeps(isDeadlineReached);
        expect(deps.sec).toEqual({ fetchFailsToDeliverListing, fetchSecFile });
        expect(deps.isSecBlockedError).toBe(isSecBlockedError);
        expect(deps.isDeadlineReached).toBe(isDeadlineReached);
    });

    it('wires cache invalidation to the symbol tag revalidation helper', () => {
        mockClient.mockReturnValue({ db: {} });
        createSecFtdDeps(() => false).invalidateSymbols(['GME']);
        expect(mockRevalidate).toHaveBeenCalledWith(['GME']);
    });
});
