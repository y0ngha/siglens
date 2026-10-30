const mockFetchOptionsSnapshot = vi.fn();
const mockGetFinancialsSnapshot = vi.fn();
const mockComputeFinancialsScorecard = vi.fn();
const mockIsEtRegularSessionOpen = vi.fn();
const mockIsOpenInterestSnapshotStale = vi.fn();

vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    fetchOptionsSnapshot: (...args: unknown[]) =>
        mockFetchOptionsSnapshot(...args),
}));
vi.mock('@/entities/financials-statements/lib/getFinancialsSnapshot', () => ({
    getFinancialsSnapshot: (...args: unknown[]) =>
        mockGetFinancialsSnapshot(...args),
}));
vi.mock('@y0ngha/siglens-core', () => ({
    computeFinancialsScorecard: (...args: unknown[]) =>
        mockComputeFinancialsScorecard(...args),
    isEtRegularSessionOpen: (...args: unknown[]) =>
        mockIsEtRegularSessionOpen(...args),
}));
vi.mock('@/shared/lib/options/openInterestStale', () => ({
    isOpenInterestSnapshotStale: (...args: unknown[]) =>
        mockIsOpenInterestSnapshotStale(...args),
}));

import {
    isOptionsOiStale,
    loadFinancialsScorecardOrUndefined,
    loadOptionsSnapshotOrNull,
} from '@/entities/analysis/server/overallAxisInputs';

const SNAPSHOT = { symbol: 'AAPL' } as never;

describe('loadOptionsSnapshotOrNull', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resolves to the fetched snapshot', async () => {
        mockFetchOptionsSnapshot.mockResolvedValue(SNAPSHOT);

        await expect(loadOptionsSnapshotOrNull('AAPL', '[tag]')).resolves.toBe(
            SNAPSHOT
        );
        expect(mockFetchOptionsSnapshot).toHaveBeenCalledWith('AAPL');
    });

    it('degrades to null and warns with the caller tag when the fetch rejects', async () => {
        const error = new Error('boom');
        mockFetchOptionsSnapshot.mockRejectedValue(error);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(
            loadOptionsSnapshotOrNull('AAPL', '[prewarmOverall]')
        ).resolves.toBeNull();
        expect(warn).toHaveBeenCalledWith(
            '[prewarmOverall] options snapshot fetch failed:',
            error
        );
        warn.mockRestore();
    });
});

describe('loadFinancialsScorecardOrUndefined', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('computes the scorecard from the financials snapshot', async () => {
        mockGetFinancialsSnapshot.mockResolvedValue({ rows: 1 });
        mockComputeFinancialsScorecard.mockReturnValue({ score: 7 });

        await expect(
            loadFinancialsScorecardOrUndefined('AAPL', '[tag]')
        ).resolves.toEqual({ score: 7 });
        expect(mockComputeFinancialsScorecard).toHaveBeenCalledWith({
            rows: 1,
        });
    });

    it('degrades to undefined and warns with the caller tag when the snapshot rejects', async () => {
        const error = new Error('boom');
        mockGetFinancialsSnapshot.mockRejectedValue(error);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(
            loadFinancialsScorecardOrUndefined(
                'AAPL',
                '[runOverallAnalysisAction]'
            )
        ).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith(
            '[runOverallAnalysisAction] financials scorecard fetch failed:',
            error
        );
        warn.mockRestore();
    });

    it('degrades to undefined when the scorecard computation throws', async () => {
        mockGetFinancialsSnapshot.mockResolvedValue({});
        mockComputeFinancialsScorecard.mockImplementation(() => {
            throw new Error('bad snapshot');
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(
            loadFinancialsScorecardOrUndefined('AAPL', '[tag]')
        ).resolves.toBeUndefined();
        warn.mockRestore();
    });
});

describe('isOptionsOiStale', () => {
    const now = new Date('2026-10-30T12:00:00.000Z');

    beforeEach(() => {
        vi.clearAllMocks();
        mockIsEtRegularSessionOpen.mockReturnValue(false);
        mockIsOpenInterestSnapshotStale.mockReturnValue(true);
    });

    it('is false without a snapshot', () => {
        expect(isOptionsOiStale(null, now)).toBe(false);
        expect(mockIsOpenInterestSnapshotStale).not.toHaveBeenCalled();
    });

    it('is false during the regular session even when the heuristic says stale', () => {
        mockIsEtRegularSessionOpen.mockReturnValue(true);

        expect(isOptionsOiStale(SNAPSHOT, now)).toBe(false);
        expect(mockIsEtRegularSessionOpen).toHaveBeenCalledWith(now);
        expect(mockIsOpenInterestSnapshotStale).not.toHaveBeenCalled();
    });

    it('delegates to the stale heuristic outside the regular session', () => {
        expect(isOptionsOiStale(SNAPSHOT, now)).toBe(true);

        mockIsOpenInterestSnapshotStale.mockReturnValue(false);
        expect(isOptionsOiStale(SNAPSHOT, now)).toBe(false);
    });
});
