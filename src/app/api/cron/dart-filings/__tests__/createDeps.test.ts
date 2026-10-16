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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dartFatalReason, realDartClient } from '@/shared/api/dart/dartClient';
import { DrizzleInvestorFlowsDartRepository } from '@/entities/investor-flows/api/investorFlowsDartRepository';
import { createDartFilingsDeps } from '../createDeps';

describe('createDartFilingsDeps', () => {
    beforeEach(() => {
        mockClient.mockReset();
        mockRevalidate.mockReset();
        mockRevalidateReadiness.mockReset();
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('throws when the database is unavailable (the cron logs "run failed")', () => {
        mockClient.mockReturnValue(null);
        expect(() => createDartFilingsDeps(() => false)).toThrow(
            '[dart-filings] database unavailable'
        );
    });

    it('wires the real DART client, the DART repository, the fatal classifier and the deadline', () => {
        vi.stubEnv('E2E_TEST', '');
        mockClient.mockReturnValue({ db: {} });
        const isDeadlineReached = () => true;
        const deps = createDartFilingsDeps(isDeadlineReached);
        expect(deps.dart).toBe(realDartClient);
        expect(deps.repo).toBeInstanceOf(DrizzleInvestorFlowsDartRepository);
        expect(deps.fatalReason).toBe(dartFatalReason);
        expect(deps.isDeadlineReached).toBe(isDeadlineReached);
    });

    it('uses the network-free fake DART client under E2E', () => {
        vi.stubEnv('E2E_TEST', '1');
        mockClient.mockReturnValue({ db: {} });
        const deps = createDartFilingsDeps(() => false);
        expect(deps.dart).not.toBe(realDartClient);
        expect(deps.dart.isEnabled()).toBe(true);
    });

    it('wires cache invalidation to the symbol tag revalidation helper', () => {
        mockClient.mockReturnValue({ db: {} });
        createDartFilingsDeps(() => false).invalidateSymbols(['005930.KS']);
        expect(mockRevalidate).toHaveBeenCalledWith(['005930.KS']);
    });

    it('wires the backfill-completed hook to the readiness cache invalidation', () => {
        mockClient.mockReturnValue({ db: {} });
        createDartFilingsDeps(() => false).onBackfillCompleted?.();
        expect(mockRevalidateReadiness).toHaveBeenCalledTimes(1);
    });
});
