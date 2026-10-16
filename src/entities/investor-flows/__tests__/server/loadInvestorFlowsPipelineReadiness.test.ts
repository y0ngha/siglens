import { describe, expect, it, vi } from 'vitest';
import {
    INVESTOR_FLOWS_STATE_BACKFILL_DONE,
    INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE,
    INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../../lib/investorFlowsPolicy';
import {
    loadInvestorFlowsPipelineReadiness,
    type PipelineReadinessDeps,
} from '../../server/loadInvestorFlowsPipelineReadiness';

const NOW = new Date('2026-10-16T09:00:00Z');

function build(
    markers: string[],
    over: Partial<PipelineReadinessDeps> = {}
): PipelineReadinessDeps {
    return {
        getState: async key => (markers.includes(key) ? 'x' : null),
        hasAnyShortRow: async () => false,
        hasAnyFtdFile: async () => false,
        listThresholdTradeDates: async () => [],
        isFinraEnabled: () => true,
        isRegShoEnabled: () => true,
        isDartEnabled: () => true,
        now: () => NOW,
        ...over,
    };
}

/** 공시 커서를 `cursor`로 돌려주는 `getState`(나머지 표식은 `markers`). */
function withCursor(markers: string[], cursor: string) {
    return async (key: string): Promise<string | null> => {
        if (key === INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR) return cursor;
        return markers.includes(key) ? 'x' : null;
    };
}

const ALL_13F = [
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
    INVESTOR_FLOWS_STATE_BACKFILL_DONE,
];
const ALL_MARKERS = [...ALL_13F, INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE];

describe('loadInvestorFlowsPipelineReadiness', () => {
    it('every source loaded -> everything ready', async () => {
        expect(
            await loadInvestorFlowsPipelineReadiness(
                build(ALL_MARKERS, {
                    getState: withCursor(ALL_MARKERS, '2026-10-15'),
                    hasAnyShortRow: async () => true,
                    hasAnyFtdFile: async () => true,
                    listThresholdTradeDates: async () => ['2026-10-15'],
                })
            )
        ).toEqual({
            institutional: 'ready',
            short: 'ready',
            failsToDeliver: 'ready',
            filings: 'ready',
            thresholdList: 'ready',
            dart: 'ready',
        });
    });

    it('nothing loaded yet -> every branch collecting (the bootstrap period)', async () => {
        expect(await loadInvestorFlowsPipelineReadiness(build([]))).toEqual({
            institutional: 'collecting',
            short: 'collecting',
            failsToDeliver: 'collecting',
            filings: 'collecting',
            thresholdList: 'collecting',
            dart: 'collecting',
        });
    });

    it('DART is ready once the initial backfill marker exists, independent of the 13F markers', async () => {
        const result = await loadInvestorFlowsPipelineReadiness(
            build([INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE])
        );
        expect(result.dart).toBe('ready');
        expect(result.institutional).toBe('collecting');
    });

    it('without a DART key the DART branch is unknown (never "collecting") and its marker is not read', async () => {
        const getState = vi.fn(async () => 'x');
        const result = await loadInvestorFlowsPipelineReadiness(
            build([], { getState, isDartEnabled: () => false })
        );
        expect(result.dart).toBe('unknown');
        expect(getState).not.toHaveBeenCalledWith(
            INVESTOR_FLOWS_STATE_DART_BACKFILL_DONE
        );
    });

    it('a filings cursor that still trails the backfill keeps filings collecting', async () => {
        const result = await loadInvestorFlowsPipelineReadiness(
            build([], { getState: withCursor([], '2026-06-01') })
        );
        expect(result.filings).toBe('collecting');
    });

    it('does not read the Reg SHO state while that flag is off, and reports it unknown', async () => {
        const listThresholdTradeDates = vi.fn(async () => ['2026-10-15']);
        const result = await loadInvestorFlowsPipelineReadiness(
            build([], {
                isRegShoEnabled: () => false,
                listThresholdTradeDates,
            })
        );
        expect(result.thresholdList).toBe('unknown');
        expect(listThresholdTradeDates).not.toHaveBeenCalled();
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
        expect(result).toMatchObject({
            institutional: 'ready',
            short: 'collecting',
        });
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
