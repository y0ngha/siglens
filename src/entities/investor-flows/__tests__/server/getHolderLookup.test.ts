vi.mock('server-only', () => ({}));

const { mockClient, mockE2E, repoReads } = vi.hoisted(() => ({
    mockClient: vi.fn(),
    mockE2E: vi.fn(() => false),
    repoReads: {
        findCusipsBySymbol: vi.fn(),
        findAggregates: vi.fn(),
        findLatestPositionPeriod: vi.fn(),
        findFilersByNameTokens: vi.fn(),
        findHolderPositions: vi.fn(),
        findFilerFilings: vi.fn(),
        countHoldersAbove: vi.fn(),
    },
}));
vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: mockClient }));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: mockE2E }));
vi.mock('../../api/investorFlowsSnapshotRepository', () => ({
    DrizzleInvestorFlowsSnapshotRepository: vi.fn(function () {
        return repoReads;
    }),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getHolderLookup,
    lookupHolder,
    type HolderLookupReads,
} from '../../server/getHolderLookup';
import {
    HOLDER_LOOKUP_MATCHES_MAX,
    HOLDER_LOOKUP_MAX_FILERS,
    HOLDER_LOOKUP_NOTE,
} from '../../model';

const TODAY = '2026-11-21';
const PERIOD = '2026-09-30';

const aggregate = (period: string) => ({
    period,
    holders: 1,
    shares: 1,
    valueUsd: 1,
    newHolders: 0,
    increased: 0,
    decreased: 0,
    exited: 0,
    netShareChange: 0,
});

/** Reads that find the stock's CUSIP and the 2026-09-30 quarter; each test overrides what it varies. */
function makeReads(over: Partial<HolderLookupReads> = {}): HolderLookupReads {
    return {
        findCusipsBySymbol: vi.fn(async () => ['CUSIP0001']),
        findAggregates: vi.fn(async () => [aggregate(PERIOD)]),
        findLatestPositionPeriod: vi.fn(async () => null),
        findFilersByNameTokens: vi.fn(async () => [
            { cik: 1, name: 'VANGUARD GROUP INC' },
        ]),
        findHolderPositions: vi.fn(async () => []),
        findFilerFilings: vi.fn(async () => []),
        countHoldersAbove: vi.fn(async () => 0),
        ...over,
    };
}

const input = (
    query: string,
    symbol = 'AAPL',
    period: string | null = null
) => ({
    symbol,
    query,
    today: TODAY,
    period,
});

describe('lookupHolder', () => {
    it('a Korean stock is not_us_stock and reads nothing', async () => {
        const reads = makeReads();
        const view = await lookupHolder(reads, input('Vanguard', '005930.KS'));
        expect(view).toEqual({
            query: 'Vanguard',
            period: null,
            status: 'not_us_stock',
            matches: [],
            matchedFilers: [],
            note: HOLDER_LOOKUP_NOTE,
        });
        expect(reads.findCusipsBySymbol).not.toHaveBeenCalled();
    });

    it('a query with no Latin token is no_matching_filer without a database read', async () => {
        const reads = makeReads();
        const view = await lookupHolder(reads, input('블랙록'));
        expect(view.status).toBe('no_matching_filer');
        expect(view.period).toBeNull();
        expect(reads.findCusipsBySymbol).not.toHaveBeenCalled();
        expect(reads.findFilersByNameTokens).not.toHaveBeenCalled();
    });

    it('no mapped CUSIP is no_13f_period', async () => {
        const reads = makeReads({ findCusipsBySymbol: async () => [] });
        const view = await lookupHolder(reads, input('Vanguard'));
        expect(view).toMatchObject({ status: 'no_13f_period', period: null });
        expect(reads.findFilersByNameTokens).not.toHaveBeenCalled();
    });

    it('no quarter with positions is no_13f_period', async () => {
        const reads = makeReads({
            findAggregates: async () => [],
            findLatestPositionPeriod: async () => null,
        });
        const view = await lookupHolder(reads, input('Vanguard'));
        expect(view).toMatchObject({ status: 'no_13f_period', period: null });
    });

    it('no filer with that name is no_matching_filer, with the period', async () => {
        const reads = makeReads({ findFilersByNameTokens: async () => [] });
        expect(
            await lookupHolder(reads, input('Nobody Capital'))
        ).toMatchObject({ status: 'no_matching_filer', period: PERIOD });
    });

    it('a candidate that only contains the name as a substring does not match', async () => {
        const reads = makeReads({
            findFilersByNameTokens: async () => [
                { cik: 2, name: 'VANGUARDIA HOLDINGS' },
            ],
        });
        expect((await lookupHolder(reads, input('Vanguard'))).status).toBe(
            'no_matching_filer'
        );
        expect(reads.findHolderPositions).not.toHaveBeenCalled();
    });

    it('the candidate read gets the query tokens', async () => {
        const reads = makeReads();
        await lookupHolder(reads, input('Vanguard Group, Inc.'));
        expect(reads.findFilersByNameTokens).toHaveBeenCalledWith(
            ['VANGUARD', 'GROUP'],
            50
        );
    });

    it(`more than ${HOLDER_LOOKUP_MAX_FILERS} matching filers is too_many_matches: names listed, no positions read`, async () => {
        const reads = makeReads({
            findFilersByNameTokens: async () =>
                ['A', 'B', 'C', 'D', 'E', 'F'].map((c, i) => ({
                    cik: i + 1,
                    name: `ACME ${c}`,
                })),
        });
        const view = await lookupHolder(reads, input('Acme'));
        expect(view.status).toBe('too_many_matches');
        expect(view.matchedFilers).toEqual([
            'ACME A',
            'ACME B',
            'ACME C',
            'ACME D',
            'ACME E',
        ]);
        expect(view.matches).toEqual([]);
        expect(reads.findHolderPositions).not.toHaveBeenCalled();
    });

    it('exactly the maximum number of matching filers is still looked up', async () => {
        const reads = makeReads({
            findFilersByNameTokens: async () =>
                ['A', 'B', 'C', 'D', 'E'].map((c, i) => ({
                    cik: i + 1,
                    name: `ACME ${c}`,
                })),
        });
        const view = await lookupHolder(reads, input('Acme'));
        expect(view.status).not.toBe('too_many_matches');
        expect(reads.findHolderPositions).toHaveBeenCalledWith(
            'CUSIP0001',
            PERIOD,
            [1, 2, 3, 4, 5]
        );
    });

    it('found: the largest positions first (max 3), with shares, value, previous shares and rank', async () => {
        const positions = [
            {
                cik: 1,
                filerName: 'VANGUARD GROUP INC',
                shares: 5_000,
                valueUsd: 500_000,
                prevShares: 4_000,
            },
            {
                cik: 2,
                filerName: 'VANGUARD FIDUCIARY TRUST COMPANY',
                shares: 3_000,
                valueUsd: 300_000,
                prevShares: null,
            },
            {
                cik: 3,
                filerName: 'VANGUARD ADVISERS',
                shares: 2_000,
                valueUsd: 200_000,
                prevShares: 2_500,
            },
            {
                cik: 4,
                filerName: 'VANGUARD ASSET MANAGEMENT',
                shares: 1_000,
                valueUsd: 100_000,
                prevShares: 1_000,
            },
        ];
        // holders with MORE shares than the given count (the rank is that + 1)
        const above = new Map([
            [5_000, 0],
            [3_000, 1],
            [2_000, 7],
        ]);
        const reads = makeReads({
            findFilersByNameTokens: async () =>
                positions.map(p => ({ cik: p.cik, name: p.filerName })),
            findHolderPositions: async () => positions,
            countHoldersAbove: async (_c, _p, shares) =>
                above.get(shares) ?? -1,
        });
        const view = await lookupHolder(reads, input('Vanguard'));
        expect(view.status).toBe('found');
        expect(view.period).toBe(PERIOD);
        expect(view.matches).toHaveLength(HOLDER_LOOKUP_MATCHES_MAX);
        expect(view.matches).toEqual([
            {
                filerName: 'VANGUARD GROUP INC',
                shares: 5_000,
                valueUsd: 500_000,
                prevShares: 4_000,
                rankByShares: 1,
            },
            // clipped to 26 characters with an ellipsis
            {
                filerName: 'VANGUARD FIDUCIARY TRUST …',
                shares: 3_000,
                valueUsd: 300_000,
                prevShares: null,
                rankByShares: 2,
            },
            {
                filerName: 'VANGUARD ADVISERS',
                shares: 2_000,
                valueUsd: 200_000,
                prevShares: 2_500,
                rankByShares: 8,
            },
        ]);
        expect(view.matchedFilers).toHaveLength(4);
        expect(view.note).toBe(HOLDER_LOOKUP_NOTE);
        // neither the CIK nor the CUSIP leaks
        expect(JSON.stringify(view)).not.toMatch(/CUSIP0001|"cik"/);
    });

    it("a period passed in (the holder list's quarter) is used as is, without choosing one from the aggregates", async () => {
        const reads = makeReads();
        const view = await lookupHolder(
            reads,
            input('Vanguard', 'AAPL', '2026-06-30')
        );
        expect(view.period).toBe('2026-06-30');
        expect(reads.findAggregates).not.toHaveBeenCalled();
        expect(reads.findHolderPositions).toHaveBeenCalledWith(
            'CUSIP0001',
            '2026-06-30',
            [1]
        );
        expect(reads.findFilerFilings).toHaveBeenCalledWith(
            'CUSIP0001',
            [1],
            '2026-06-30'
        );
    });

    it('without a period it falls back to the newest complete quarter', async () => {
        const reads = makeReads();
        expect((await lookupHolder(reads, input('Vanguard'))).period).toBe(
            PERIOD
        );
        expect(reads.findAggregates).toHaveBeenCalled();
    });

    it('a name with an ampersand matches the filer (both sides normalize & to AND)', async () => {
        const reads = makeReads({
            findFilersByNameTokens: async () => [
                { cik: 9, name: 'DODGE & COX' },
                { cik: 10, name: 'DODGE FUND' },
            ],
        });
        const view = await lookupHolder(reads, input('Dodge & Cox'));
        expect(reads.findHolderPositions).toHaveBeenCalledWith(
            'CUSIP0001',
            PERIOD,
            [9]
        );
        expect(view.matchedFilers).toEqual(['DODGE & COX']);
    });

    describe('when no matching filer lists the stock', () => {
        const filing = (
            cik: number,
            processed: boolean,
            couldListCusip: boolean
        ) => ({
            cik,
            processed,
            couldListCusip,
        });
        const run = (filings: ReturnType<typeof filing>[]) =>
            lookupHolder(
                makeReads({ findFilerFilings: async () => filings }),
                input('Vanguard')
            );

        it('not_holding: the filing is processed and was parsed after the CUSIP was mapped', async () => {
            expect(await run([filing(1, true, true)])).toMatchObject({
                status: 'not_holding',
                period: PERIOD,
                matchedFilers: ['VANGUARD GROUP INC'],
            });
        });

        it('not_determinable: the filing was parsed before the CUSIP was mapped', async () => {
            expect((await run([filing(1, true, false)])).status).toBe(
                'not_determinable'
            );
        });

        it('not_determinable wins when one processed filing could list it and another could not', async () => {
            expect(
                (await run([filing(1, true, true), filing(1, true, false)]))
                    .status
            ).toBe('not_determinable');
        });

        it('no_filing_for_period: no filing at all', async () => {
            expect((await run([])).status).toBe('no_filing_for_period');
        });

        it('no_filing_for_period: only an unprocessed filing', async () => {
            expect((await run([filing(1, false, false)])).status).toBe(
                'no_filing_for_period'
            );
        });

        it('reads the filings for the same quarter as the holder list', async () => {
            const reads = makeReads();
            await lookupHolder(reads, input('Vanguard'));
            expect(reads.findFilerFilings).toHaveBeenCalledWith(
                'CUSIP0001',
                [1],
                PERIOD
            );
        });
    });
});

describe('getHolderLookup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockE2E.mockReturnValue(false);
        mockClient.mockReturnValue({ db: {} });
        repoReads.findCusipsBySymbol.mockResolvedValue([]);
    });

    it('E2E: a Korean symbol is not_us_stock, as in production', async () => {
        mockE2E.mockReturnValue(true);
        expect((await getHolderLookup('005930.KS', 'Vanguard')).status).toBe(
            'not_us_stock'
        );
    });

    it('passes the period through to the lookup', async () => {
        repoReads.findCusipsBySymbol.mockResolvedValue(['CUSIP0001']);
        repoReads.findFilersByNameTokens.mockResolvedValue([]);
        const view = await getHolderLookup('AAPL', 'Vanguard', '2026-06-30');
        expect(view).toMatchObject({
            status: 'no_matching_filer',
            period: '2026-06-30',
        });
        expect(repoReads.findAggregates).not.toHaveBeenCalled();
    });

    it('E2E has no 13F rows: no_matching_filer without touching the database', async () => {
        mockE2E.mockReturnValue(true);
        const view = await getHolderLookup('AAPL', 'Vanguard');
        expect(view).toMatchObject({
            query: 'Vanguard',
            status: 'no_matching_filer',
            period: null,
        });
        expect(mockClient).not.toHaveBeenCalled();
    });

    it('throws when the database is unavailable (the tool degrades it)', async () => {
        mockClient.mockReturnValue(null);
        await expect(getHolderLookup('AAPL', 'Vanguard')).rejects.toThrow(
            'database unavailable'
        );
    });

    it('runs the lookup over the repository reads', async () => {
        const view = await getHolderLookup('AAPL', 'Vanguard');
        expect(repoReads.findCusipsBySymbol).toHaveBeenCalledWith('AAPL');
        expect(view.status).toBe('no_13f_period');
    });
});
