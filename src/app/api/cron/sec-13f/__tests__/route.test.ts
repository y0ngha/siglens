const { mockHandle, mockRun13f, mockRunFilings, mockCreateDeps } = vi.hoisted(
    () => ({
        mockHandle: vi.fn(),
        mockRun13f: vi.fn(),
        mockRunFilings: vi.fn(),
        mockCreateDeps: vi.fn(),
    })
);
vi.mock('../../leasedCron', async importOriginal => ({
    ...(await importOriginal<typeof import('../../leasedCron')>()),
    handleLeasedCron: mockHandle,
}));
vi.mock('@/entities/investor-flows/server/ingest13f', () => ({
    run13fIngest: mockRun13f,
}));
vi.mock('@/entities/investor-flows/server/ingestSecFilings', () => ({
    runSecFilingsIngest: mockRunFilings,
}));
vi.mock('../createDeps', () => ({ createSec13fDeps: mockCreateDeps }));
vi.mock('server-only', () => ({}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SEC_HEADER_TIMEOUT_MS,
    SEC_INFO_TABLE_BODY_BUDGET_MS,
    SEC_REQUEST_TIMEOUT_MS,
    SEC_RETRY_BACKOFF_BUDGET_MS,
} from '@/shared/config/investorFlows';
import {
    INVESTOR_FLOWS_MAINTENANCE_BUDGET_MS,
    INVESTOR_FLOWS_MAINTENANCE_CHUNK_MS,
} from '@/entities/investor-flows/lib/investorFlowsPolicy';
import {
    SEC_13F_LEGACY_LEASE_NAME,
    SEC_CRON_LEASE_NAME,
} from '../../leasedCron';
import { PATCH } from '../route';

/** DB wrap-up of the filings step after its last document (store + daily prune + backlog count): an allowance, not a timeout. */
const FILINGS_DB_ALLOWANCE_MS = 30_000;

type RunOptions = {
    name: string;
    leaseName?: string;
    legacyLeaseNames?: readonly string[];
    leaseTtlSeconds: number;
    deadlineMs: number;
    run: (ctx: { isDeadlineReached: () => boolean }) => Promise<unknown>;
};

const request = (): Request =>
    new Request('http://localhost/api/cron/sec-13f', { method: 'PATCH' });

async function capturedOptions(): Promise<RunOptions> {
    await PATCH(request());
    const call = mockHandle.mock.calls.find(
        ([, options]) => (options as RunOptions).name === 'sec-13f'
    );
    return call?.[1] as RunOptions;
}

describe('PATCH /api/cron/sec-13f', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHandle.mockResolvedValue(new Response(null, { status: 202 }));
    });

    it('delegates to the leased cron and passes the request through', async () => {
        const req = request();
        expect((await PATCH(req)).status).toBe(202);
        expect(mockHandle).toHaveBeenCalledWith(req, expect.anything());
    });

    it('takes the SHARED SEC lease with the documented TTL and deadline', async () => {
        expect(await capturedOptions()).toMatchObject({
            name: 'sec-13f',
            leaseName: SEC_CRON_LEASE_NAME,
            // this release also holds the old per-cron key so an old instance mid-rollout cannot overlap
            legacyLeaseNames: [SEC_13F_LEGACY_LEASE_NAME],
            leaseTtlSeconds: 2100,
            deadlineMs: 600_000,
        });
    });

    it('the legacy key is the old per-cron key (the cron name the previous release locked on)', async () => {
        const options = await capturedOptions();
        expect(SEC_13F_LEGACY_LEASE_NAME).toBe(options.name);
    });

    it('CC-7: the lease outlives the sum of every stage’s worst case, derived from the real budgets', async () => {
        const options = await capturedOptions();
        const smallDocument =
            2 * SEC_REQUEST_TIMEOUT_MS + SEC_RETRY_BACKOFF_BUDGET_MS;
        const informationTable =
            2 * SEC_HEADER_TIMEOUT_MS +
            SEC_RETRY_BACKOFF_BUDGET_MS +
            SEC_INFO_TABLE_BODY_BUDGET_MS;
        const inFlightFiling = 2 * smallDocument + informationTable;
        // a RESTATEMENT re-apply download already started when the deadline passes (index.json + information table)
        const inFlightReapply = smallDocument + informationTable;
        const maintenance =
            INVESTOR_FLOWS_MAINTENANCE_BUDGET_MS +
            INVESTOR_FLOWS_MAINTENANCE_CHUNK_MS;
        // Form 144 / 424B5 step: one small document in flight (two run in parallel) + its DB wrap-up
        const filingsStep = smallDocument + FILINGS_DB_ALLOWANCE_MS;
        const worstCaseMs =
            options.deadlineMs +
            inFlightFiling +
            inFlightReapply +
            2 * maintenance + // flush + prune
            filingsStep;
        expect(options.leaseTtlSeconds * 1000).toBeGreaterThan(worstCaseMs);
    });

    it('runs 13F then the filings step, each with its own step deadline over the deps built from the deadline callback', async () => {
        const filingsDeps = {
            marker: 'filings',
            repo: { getState: vi.fn(async () => '2026-10-15') },
            now: () => new Date('2026-10-16T12:00:00Z'),
            log: vi.fn(),
        };
        mockCreateDeps.mockReturnValue({
            thirteenF: { marker: '13f' },
            filings: filingsDeps,
        });
        mockRun13f.mockResolvedValue({ stoppedBy: 'deadline' });
        mockRunFilings.mockResolvedValue({ stoppedBy: 'complete' });
        const options = await capturedOptions();
        const isDeadlineReached = () => true;
        expect(await options.run({ isDeadlineReached })).toEqual({
            thirteenF: { stoppedBy: 'deadline' },
            filings: { stoppedBy: 'complete' },
        });
        expect(mockCreateDeps).toHaveBeenCalledWith(isDeadlineReached);
        expect(mockRun13f).toHaveBeenCalledWith({
            marker: '13f',
            isDeadlineReached: expect.any(Function),
        });
        expect(mockRunFilings).toHaveBeenCalledWith({
            ...filingsDeps,
            isDeadlineReached: expect.any(Function),
        });
        // The step deadlines are fresh budgets, not the already-expired run callback.
        const thirteenFDeps = (
            mockRun13f.mock.calls as [
                { marker?: string; isDeadlineReached: () => boolean },
            ][]
        ).find(([deps]) => deps.marker === '13f')?.[0];
        expect(thirteenFDeps?.isDeadlineReached()).toBe(false);
        expect(filingsDeps.repo.getState).toHaveBeenCalledWith(
            'sec_filings_cursor'
        );
    });

    it('skips the filings step when 13F stopped on a SEC block', async () => {
        mockCreateDeps.mockReturnValue({
            thirteenF: {},
            filings: {
                repo: { getState: async () => null },
                now: () => new Date(),
                log: () => {},
            },
        });
        mockRun13f.mockResolvedValue({ stoppedBy: 'sec_blocked' });
        const options = await capturedOptions();
        expect(await options.run({ isDeadlineReached: () => false })).toEqual({
            thirteenF: { stoppedBy: 'sec_blocked' },
            filings: { skipped: 'sec_blocked' },
        });
        expect(mockRunFilings).not.toHaveBeenCalled();
    });
});
