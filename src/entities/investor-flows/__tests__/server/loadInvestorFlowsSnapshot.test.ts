import { describe, expect, it, vi } from 'vitest';
import type { InvestorFlowsFmpProvider } from '@/shared/api/fmp/investorFlowsProvider.types';
import {
    DbFmpInvestorFlowsDataProvider,
    loadInvestorFlowsSnapshot,
    type InvestorFlowsSnapshotDeps,
    type InvestorFlowsSnapshotReads,
} from '../../server/loadInvestorFlowsSnapshot';

const AAPL_CUSIP = '037833100';

function build(
    over: {
        finra?: boolean;
        reads?: Partial<InvestorFlowsSnapshotReads>;
        fmp?: Partial<InvestorFlowsFmpProvider>;
    } = {}
) {
    const reads: InvestorFlowsSnapshotReads = {
        findCusipsBySymbol: vi.fn(async (symbol: string) =>
            symbol === 'AAPL' ? [AAPL_CUSIP] : []
        ),
        findAggregates: vi.fn(async () => [
            {
                period: '2026-06-30',
                holders: 5300,
                shares: 9e9,
                valueUsd: 2e12,
                newHolders: 100,
                increased: 2000,
                decreased: 1800,
                exited: 90,
                netShareChange: 1e7,
            },
        ]),
        findLatestPositionPeriod: vi.fn(async () => '2026-06-30'),
        findTopHolders: vi.fn(async () => [
            {
                cik: '0000102909',
                filerName: 'VANGUARD GROUP INC',
                shares: 1.4e9,
                valueUsd: 3e11,
                prevShares: 1.3e9,
            },
        ]),
        findExitedHolders: vi.fn(async () => [
            {
                cik: '0000000001',
                filerName: 'Gone LLC',
                shares: 0,
                valueUsd: 0,
                prevShares: 500,
            },
        ]),
        findShortInterest: vi.fn(async () => [
            {
                settlementDate: '2026-09-30',
                shortQty: 120763539,
                avgDailyVolume: 39858260,
                daysToCover: 3.03,
            },
        ]),
        findShortVolume: vi.fn(async () => [
            {
                tradeDate: '2026-10-14',
                shortVolume: 9631784,
                totalVolume: 16757127,
            },
        ]),
        ...over.reads,
    };
    const fmp: InvestorFlowsFmpProvider = {
        getInsiderTrades: vi.fn(async () => [
            {
                filingDate: '2026-10-08',
                transactionDate: '2026-10-06',
                transactionType: 'S-Sale',
                reportingName: 'Newstead Jennifer',
                typeOfOwner: 'officer',
                securitiesTransacted: 2399,
                price: 332.01,
                url: 'https://x',
            },
        ]),
        getInsiderStatistics: vi.fn(async () => [
            { year: 2026, quarter: 4, totalSales: 11 },
        ]),
        getBeneficialOwnership: vi.fn(async () => [
            {
                filingDate: '2026-04-29',
                nameOfReportingPerson: 'Vanguard Capital Management',
                percentOfClass: '7.48',
                form: 'SCHEDULE 13G/A',
                amountBeneficiallyOwned: '1099168953',
                url: 'https://x/SCHEDULE_13G_X02/primary_doc.xml',
            },
        ]),
        getSharesFloat: vi.fn(async () => ({
            floatShares: 14576876685,
            outstandingShares: 14594180000,
        })),
        ...over.fmp,
    };
    const deps: InvestorFlowsSnapshotDeps = {
        reads,
        fmp,
        isFinraEnabled: () => over.finra ?? true,
        now: () => new Date('2026-10-15T12:00:00Z'),
        log: vi.fn(),
    };
    return { deps, reads, fmp };
}

describe('loadInvestorFlowsSnapshot', () => {
    describe('assembly from DB + FMP', () => {
        it('combines 13F quarters, holders with change, insider, 13D/G, float and FINRA series', async () => {
            const { deps } = build();
            const snapshot = await loadInvestorFlowsSnapshot('aapl', deps);
            expect(snapshot?.institutional.quarters[0]).toMatchObject({
                period: '2026-06-30',
                complete: true,
                holders: 5300,
                netShareChange: 1e7,
            });
            expect(
                snapshot?.institutional.topHolders.map(h => [
                    h.filerName,
                    h.change,
                ])
            ).toEqual([
                ['VANGUARD GROUP INC', 'increased'],
                ['Gone LLC', 'exited'],
            ]);
            expect(snapshot?.insider.transactions[0]).toMatchObject({
                name: 'Newstead Jennifer',
                type: 'sell',
            });
            expect(snapshot?.largeHolders?.[0]).toMatchObject({
                form: 'SCHEDULE 13G/A',
                percentOfClass: 7.48,
            });
            expect(snapshot).toMatchObject({
                sharesOutstanding: 14594180000,
                floatShares: 14576876685,
            });
            expect(snapshot?.shortInterest).toHaveLength(1);
            expect(snapshot?.shortVolume).toEqual([
                {
                    date: '2026-10-14',
                    shortVolume: 9631784,
                    totalVolume: 16757127,
                },
            ]);
        });

        it('reads the DB with the mapped CUSIP and the latest position period', async () => {
            const { deps, reads } = build();
            await loadInvestorFlowsSnapshot('AAPL', deps);
            expect(reads.findAggregates).toHaveBeenCalledWith(AAPL_CUSIP, 8);
            expect(reads.findTopHolders).toHaveBeenCalledWith(
                AAPL_CUSIP,
                '2026-06-30',
                25
            );
            expect(reads.findExitedHolders).toHaveBeenCalledWith(
                AAPL_CUSIP,
                '2026-06-30',
                5,
                false // complete quarter: full prior quarter, not only filers so far
            );
        });

        it('uppercases the symbol for every source', async () => {
            const { deps, fmp, reads } = build();
            await loadInvestorFlowsSnapshot('aapl', deps);
            expect(reads.findCusipsBySymbol).toHaveBeenCalledWith('AAPL');
            expect(fmp.getInsiderTrades).toHaveBeenCalledWith('AAPL', 365);
            expect(reads.findShortVolume).toHaveBeenCalledWith('AAPL', 120);
        });
    });

    describe('top holders period', () => {
        const agg = (period: string, newHolders: number | null) => ({
            period,
            holders: 1,
            shares: 1,
            valueUsd: 1,
            newHolders,
            increased: 0,
            decreased: 0,
            exited: 0,
            netShareChange: 0,
        });

        it('uses the latest COMPLETE quarter, not the in-progress one (core scores consensus only for the scored quarter)', async () => {
            const { deps, reads } = build({
                reads: {
                    findAggregates: async () => [
                        agg('2026-09-30', 5),
                        agg('2026-06-30', 7),
                    ],
                },
            });
            const snapshot = await loadInvestorFlowsSnapshot('AAPL', deps);
            expect(reads.findTopHolders).toHaveBeenCalledWith(
                AAPL_CUSIP,
                '2026-06-30',
                25
            );
            expect(reads.findExitedHolders).toHaveBeenCalledWith(
                AAPL_CUSIP,
                '2026-06-30',
                5,
                false // complete quarter: full prior quarter, not only filers so far
            );
            expect(snapshot?.institutional.topHoldersPeriod).toBe('2026-06-30');
        });

        it('reports topHoldersPeriod null when that quarter has no prior-quarter baseline, but still lists the holders', async () => {
            const { deps } = build({
                reads: {
                    findAggregates: async () => [agg('2026-06-30', null)],
                },
            });
            const snapshot = await loadInvestorFlowsSnapshot('AAPL', deps);
            expect(snapshot?.institutional.topHoldersPeriod).toBeNull();
            expect(snapshot?.institutional.topHolders.length).toBeGreaterThan(
                0
            );
        });

        it('falls back to the latest quarter with positions when no complete quarter exists', async () => {
            const { deps, reads } = build({
                reads: {
                    findAggregates: async () => [agg('2026-09-30', 5)],
                    findLatestPositionPeriod: async () => '2026-09-30',
                },
            });
            await loadInvestorFlowsSnapshot('AAPL', deps);
            expect(reads.findTopHolders).toHaveBeenCalledWith(
                AAPL_CUSIP,
                '2026-09-30',
                25
            );
        });

        it('ignores complete quarters older than the positions retention floor', async () => {
            const { deps, reads } = build({
                reads: {
                    findAggregates: async () => [
                        agg('2025-09-30', 5),
                        agg('2026-09-30', 5),
                    ],
                    findLatestPositionPeriod: async () => '2026-09-30',
                },
            });
            await loadInvestorFlowsSnapshot('AAPL', deps);
            expect(reads.findTopHolders).toHaveBeenCalledWith(
                AAPL_CUSIP,
                '2026-09-30',
                25
            );
        });
    });

    describe('exited holders definition', () => {
        it('uses the "already filed" restriction only for an in-progress quarter', async () => {
            const { deps, reads } = build({
                reads: {
                    findAggregates: async () => [],
                    findLatestPositionPeriod: async () => '2026-09-30',
                },
            });
            await loadInvestorFlowsSnapshot('AAPL', deps);
            expect(reads.findExitedHolders).toHaveBeenCalledWith(
                AAPL_CUSIP,
                '2026-09-30',
                5,
                true
            );
        });
    });

    describe('optional fields degrade instead of failing the snapshot', () => {
        it('drops insider statistics to [] when only that call fails (and logs)', async () => {
            const { deps } = build({
                fmp: {
                    getInsiderStatistics: async () => {
                        throw new Error('stats down');
                    },
                },
            });
            const snapshot = await loadInvestorFlowsSnapshot('AAPL', deps);
            expect(snapshot?.insider.stats).toEqual([]);
            expect(snapshot?.insider.transactions).toHaveLength(1);
            expect(deps.log).toHaveBeenCalled();
        });

        it('still fails the snapshot when the core insider transactions call fails', async () => {
            const { deps } = build({
                fmp: {
                    getInsiderTrades: async () => {
                        throw new Error('FMP down');
                    },
                },
            });
            await expect(
                loadInvestorFlowsSnapshot('AAPL', deps)
            ).rejects.toThrow('FMP down');
        });
    });

    describe('FINRA switched off', () => {
        it('returns null short fields and does not read the FINRA tables at all', async () => {
            const { deps, reads } = build({ finra: false });
            const snapshot = await loadInvestorFlowsSnapshot('AAPL', deps);
            expect(snapshot?.shortInterest).toBeNull();
            expect(snapshot?.shortVolume).toBeNull();
            expect(reads.findShortInterest).not.toHaveBeenCalled();
            expect(reads.findShortVolume).not.toHaveBeenCalled();
        });

        it('keeps the other sections intact', async () => {
            const { deps } = build({ finra: false });
            const snapshot = await loadInvestorFlowsSnapshot('AAPL', deps);
            expect(snapshot?.institutional.quarters).toHaveLength(1);
            expect(snapshot?.insider.transactions).toHaveLength(1);
        });
    });

    describe('symbols without a CUSIP mapping', () => {
        it('skips every 13F read but still returns FMP data', async () => {
            const { deps, reads } = build();
            const snapshot = await loadInvestorFlowsSnapshot('ZZZZ', deps);
            expect(reads.findAggregates).not.toHaveBeenCalled();
            expect(snapshot?.institutional).toEqual({
                quarters: [],
                topHolders: [],
                topHoldersPeriod: null,
            });
            expect(snapshot?.insider.transactions).toHaveLength(1);
        });

        it('returns null when no source has anything', async () => {
            const { deps } = build({
                fmp: {
                    getInsiderTrades: async () => [],
                    getInsiderStatistics: async () => [],
                    getBeneficialOwnership: async () => [],
                    getSharesFloat: async () => null,
                },
                reads: {
                    findShortInterest: async () => [],
                    findShortVolume: async () => [],
                },
            });
            expect(await loadInvestorFlowsSnapshot('ZZZZ', deps)).toBeNull();
        });
    });

    describe('failures', () => {
        it('propagates an infrastructure failure (so the resilient loader can degrade)', async () => {
            const { deps } = build({
                fmp: {
                    getInsiderTrades: async () => {
                        throw new Error('FMP down');
                    },
                },
            });
            await expect(
                loadInvestorFlowsSnapshot('AAPL', deps)
            ).rejects.toThrow('FMP down');
        });

        it('propagates a DB failure', async () => {
            const { deps } = build({
                reads: {
                    findCusipsBySymbol: async () => {
                        throw new Error('db down');
                    },
                },
            });
            await expect(
                loadInvestorFlowsSnapshot('AAPL', deps)
            ).rejects.toThrow('db down');
        });

        it('sets largeHolders to null when only the 13D/G call fails, keeping everything else', async () => {
            const { deps } = build({
                fmp: {
                    getBeneficialOwnership: async () => {
                        throw new Error('13dg down');
                    },
                },
            });
            const snapshot = await loadInvestorFlowsSnapshot('AAPL', deps);
            expect(snapshot?.largeHolders).toBeNull();
            expect(snapshot?.insider.transactions).toHaveLength(1);
            expect(deps.log).toHaveBeenCalled();
        });

        it('continues without shares-float when only that call fails', async () => {
            const { deps } = build({
                fmp: {
                    getSharesFloat: async () => {
                        throw new Error('float down');
                    },
                },
            });
            const snapshot = await loadInvestorFlowsSnapshot('AAPL', deps);
            expect(snapshot).toMatchObject({
                sharesOutstanding: null,
                floatShares: null,
            });
            expect(deps.log).toHaveBeenCalled();
        });
    });

    it('DbFmpInvestorFlowsDataProvider implements the port by delegating to the loader', async () => {
        const { deps } = build();
        const provider = new DbFmpInvestorFlowsDataProvider(deps);
        expect((await provider.getInvestorFlowsSnapshot('AAPL'))?.asOf).toBe(
            '2026-10-15T12:00:00.000Z'
        );
    });
});
