const { mockClient, mockRevalidate, mockRevalidateReadiness, mockFetchIndex } =
    vi.hoisted(() => ({
        mockClient: vi.fn(),
        mockRevalidate: vi.fn(),
        mockRevalidateReadiness: vi.fn(),
        mockFetchIndex: vi.fn(),
    }));
vi.mock('../../revalidateSymbols', () => ({
    revalidateSymbols: mockRevalidate,
}));
vi.mock('../../revalidateFlowsReadiness', () => ({
    revalidateFlowsReadiness: mockRevalidateReadiness,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: mockClient }));
vi.mock('@/shared/api/sec/secClient', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/api/sec/secClient')>()),
    fetchDailyFormIndex: mockFetchIndex,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSecBlockedError } from '@/shared/api/sec/secClient';
import { createSec13fDeps } from '../createDeps';

describe('createSec13fDeps', () => {
    beforeEach(() => {
        mockClient.mockReset();
        mockFetchIndex.mockReset();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('throws when the database is unavailable (the cron logs "run failed")', () => {
        mockClient.mockReturnValue(null);
        expect(() => createSec13fDeps(() => false)).toThrow(
            '[sec-13f] database unavailable'
        );
    });

    it('builds both steps with the deadline callback and the shared SEC block detector', () => {
        mockClient.mockReturnValue({ db: {} });
        const isDeadlineReached = () => true;
        const { thirteenF, filings } = createSec13fDeps(isDeadlineReached);
        expect(thirteenF.isDeadlineReached).toBe(isDeadlineReached);
        expect(filings.isDeadlineReached).toBe(isDeadlineReached);
        expect(thirteenF.isSecBlockedError).toBe(isSecBlockedError);
        expect(filings.isSecBlockedError).toBe(isSecBlockedError);
        expect(Object.keys(thirteenF.sec).sort()).toEqual([
            'fetchDailyFormIndex',
            'fetchFilingDocumentStream',
            'fetchFilingDocumentText',
            'fetchFilingIndexJson',
        ]);
        expect(Object.keys(filings.sec).sort()).toEqual([
            'fetchDailyFormIndex',
            'fetchFilingDocumentHead',
            'fetchFilingDocumentText',
        ]);
    });

    it('shares a recent daily index between the 13F and filings steps (one SEC request per day)', async () => {
        mockClient.mockReturnValue({ db: {} });
        mockFetchIndex.mockResolvedValue('index-text');
        const { thirteenF, filings } = createSec13fDeps(() => false);
        await thirteenF.sec.fetchDailyFormIndex('2026-10-14');
        expect(await filings.sec.fetchDailyFormIndex('2026-10-14')).toBe(
            'index-text'
        );
        expect(mockFetchIndex).toHaveBeenCalledTimes(1);
    });

    it('does not keep old backfill indexes in memory (each step fetches them itself)', async () => {
        mockClient.mockReturnValue({ db: {} });
        mockFetchIndex.mockResolvedValue('old');
        const { thirteenF, filings } = createSec13fDeps(() => false);
        await thirteenF.sec.fetchDailyFormIndex('2026-05-01');
        await filings.sec.fetchDailyFormIndex('2026-05-01');
        expect(mockFetchIndex).toHaveBeenCalledTimes(2);
    });

    it('wires cache invalidation of both steps to the symbol tag revalidation helper', () => {
        mockClient.mockReturnValue({ db: {} });
        const { thirteenF, filings } = createSec13fDeps(() => false);
        thirteenF.invalidateSymbols(['AAPL']);
        filings.invalidateSymbols(['TSLA']);
        expect(mockRevalidate).toHaveBeenCalledWith(['AAPL']);
        expect(mockRevalidate).toHaveBeenCalledWith(['TSLA']);
    });

    it('wires the backfill-completed hook to the readiness-cache invalidation', () => {
        mockClient.mockReturnValue({ db: {} });
        createSec13fDeps(() => false).thirteenF.onBackfillCompleted?.();
        expect(mockRevalidateReadiness).toHaveBeenCalledTimes(1);
    });

    it('wires the filings caught-up hook to the readiness-cache invalidation', () => {
        mockClient.mockReturnValue({ db: {} });
        mockRevalidateReadiness.mockReset();
        createSec13fDeps(() => false).filings.onCaughtUp?.();
        expect(mockRevalidateReadiness).toHaveBeenCalledTimes(1);
    });
});
