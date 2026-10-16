import { describe, expect, it, vi } from 'vitest';
import {
    INVESTOR_FLOWS_STATE_BACKFILL_DONE,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../../lib/investorFlowsPolicy';
import {
    loadInvestorFlowsPipelineReadiness,
    type PipelineReadinessDeps,
} from '../../server/loadInvestorFlowsPipelineReadiness';

function build(
    markers: string[],
    over: Partial<PipelineReadinessDeps> = {}
): PipelineReadinessDeps {
    return {
        getState: async key => (markers.includes(key) ? 'x' : null),
        hasAnyShortRow: async () => false,
        isFinraEnabled: () => true,
        ...over,
    };
}

describe('loadInvestorFlowsPipelineReadiness', () => {
    it('both 13F markers + a FINRA row -> everything ready', async () => {
        expect(
            await loadInvestorFlowsPipelineReadiness(
                build(
                    [
                        INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
                        INVESTOR_FLOWS_STATE_BACKFILL_DONE,
                    ],
                    { hasAnyShortRow: async () => true }
                )
            )
        ).toEqual({ institutional: 'ready', short: 'ready' });
    });

    it('no markers and empty FINRA tables -> both collecting (the bootstrap period)', async () => {
        expect(await loadInvestorFlowsPipelineReadiness(build([]))).toEqual({
            institutional: 'collecting',
            short: 'collecting',
        });
    });

    it('cusip-map done but the 13F backfill not finished is still collecting', async () => {
        const result = await loadInvestorFlowsPipelineReadiness(
            build([INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE])
        );
        expect(result.institutional).toBe('collecting');
    });

    it('the 13F and FINRA branches are independent', async () => {
        const result = await loadInvestorFlowsPipelineReadiness(
            build(
                [
                    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
                    INVESTOR_FLOWS_STATE_BACKFILL_DONE,
                ],
                { hasAnyShortRow: async () => false }
            )
        );
        expect(result).toEqual({ institutional: 'ready', short: 'collecting' });
    });

    it('does not touch the FINRA tables while the flag is off, and reports short as unknown', async () => {
        const hasAnyShortRow = vi.fn(async () => true);
        const result = await loadInvestorFlowsPipelineReadiness(
            build([], { isFinraEnabled: () => false, hasAnyShortRow })
        );
        expect(result.short).toBe('unknown');
        expect(hasAnyShortRow).not.toHaveBeenCalled();
    });

    it('propagates infrastructure errors (the cached wrapper maps them to unknown)', async () => {
        await expect(
            loadInvestorFlowsPipelineReadiness(
                build([], {
                    getState: async () => {
                        throw new Error('db down');
                    },
                })
            )
        ).rejects.toThrow('db down');
    });
});
