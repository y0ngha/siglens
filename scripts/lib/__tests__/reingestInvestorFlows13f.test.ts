import { describe, expect, it, vi } from 'vitest';
import {
    INVESTOR_FLOWS_13F_BACKFILL_DAYS,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../../../src/entities/investor-flows/lib/investorFlowsPolicy';
import {
    FILINGS_PER_RUN,
    prepareReingest,
    RUN_INTERVAL_HOURS,
    SEC_REQUESTS_PER_FILING,
    type ReingestDeps,
} from '../reingestInvestorFlows13f';

const TODAY = '2026-10-15';
const SINCE = '2026-03-29'; // TODAY − 200 days

function build(
    over: Partial<ReingestDeps> = {},
    rows = { rows: 2_000, processed: 1_900, unprocessed: 100 }
) {
    const deleted: string[] = [];
    const deps: ReingestDeps = {
        getState: async key =>
            key === INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE
                ? '2026-10-01T00:00:00.000Z'
                : null,
        countLedgerSince: async () => rows,
        deleteLedgerSince: async since => {
            deleted.push(since);
            return rows.rows;
        },
        log: vi.fn(),
        ...over,
    };
    return { deps, deleted };
}

describe('prepareReingest', () => {
    it('deletes the ledger window that sec-13f would scan (backfill days before today) and reports the count', async () => {
        const { deps, deleted } = build();
        const result = await prepareReingest(deps, {
            today: TODAY,
            dryRun: false,
        });
        expect(INVESTOR_FLOWS_13F_BACKFILL_DAYS).toBe(200);
        expect(deleted).toEqual([SINCE]);
        expect(result).toMatchObject({
            sinceDate: SINCE,
            deleted: 2_000,
            dryRun: false,
        });
    });

    it('--dry-run writes nothing but still reports the cost', async () => {
        const { deps, deleted } = build();
        const result = await prepareReingest(deps, {
            today: TODAY,
            dryRun: true,
        });
        expect(deleted).toEqual([]);
        expect(result.deleted).toBe(0);
        expect(result.ledger.rows).toBe(2_000);
    });

    it('estimates SEC requests (3 per filing + one daily index per weekday), runs and hours from the documented rates', async () => {
        const { deps } = build();
        const result = await prepareReingest(deps, {
            today: TODAY,
            dryRun: true,
        });
        // 2026-03-29 (Sunday) .. 2026-10-15 inclusive = 201 days → 144 weekdays
        expect(result.indexRequests).toBe(144);
        expect(result.estimatedSecRequests).toBe(
            2_000 * SEC_REQUESTS_PER_FILING + 144
        );
        expect(result.estimatedRuns).toBe(Math.ceil(2_000 / FILINGS_PER_RUN));
        expect(result.estimatedHours).toBe(3 * RUN_INTERVAL_HOURS);
    });

    it('refuses (and deletes nothing) until cusip-map has finished a full pass', async () => {
        const { deps, deleted } = build({ getState: async () => null });
        await expect(
            prepareReingest(deps, { today: TODAY, dryRun: false })
        ).rejects.toThrow(/full pass/);
        expect(deleted).toEqual([]);
    });
});
