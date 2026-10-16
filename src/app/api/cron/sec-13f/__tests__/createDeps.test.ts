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
import { SecHttpError } from '@/shared/api/sec/secClient';
import { createSec13fDeps, isSecBlockedError } from '../createDeps';

describe('isSecBlockedError', () => {
    it.each([403, 429])('treats SEC %i as a block (stop hammering)', status => {
        expect(isSecBlockedError(new SecHttpError('u', status, null))).toBe(
            true
        );
    });

    it('does not treat a 5xx or a plain error as a block', () => {
        expect(isSecBlockedError(new SecHttpError('u', 503, null))).toBe(false);
        expect(isSecBlockedError(new Error('403'))).toBe(false);
    });
});

describe('createSec13fDeps', () => {
    beforeEach(() => {
        mockClient.mockReset();
    });

    it('throws when the database is unavailable (the cron logs "run failed")', () => {
        mockClient.mockReturnValue(null);
        expect(() => createSec13fDeps(() => false)).toThrow(
            '[sec-13f] database unavailable'
        );
    });

    it('builds deps that carry the deadline callback through', () => {
        mockClient.mockReturnValue({ db: {} });
        const isDeadlineReached = () => true;
        const deps = createSec13fDeps(isDeadlineReached);
        expect(deps.isDeadlineReached).toBe(isDeadlineReached);
        expect(deps.isSecBlockedError).toBe(isSecBlockedError);
        expect(Object.keys(deps.sec).sort()).toEqual([
            'fetchDailyFormIndex',
            'fetchFilingDocumentStream',
            'fetchFilingDocumentText',
            'fetchFilingIndexJson',
        ]);
    });

    it('wires cache invalidation to the symbol tag revalidation helper', () => {
        mockClient.mockReturnValue({ db: {} });
        createSec13fDeps(() => false).invalidateSymbols(['AAPL']);
        expect(mockRevalidate).toHaveBeenCalledWith(['AAPL']);
    });

    it('wires the backfill-completed hook to the readiness-cache invalidation', () => {
        mockClient.mockReturnValue({ db: {} });
        createSec13fDeps(() => false).onBackfillCompleted?.();
        expect(mockRevalidateReadiness).toHaveBeenCalledTimes(1);
    });
});
