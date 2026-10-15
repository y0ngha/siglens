import { describe, expect, it } from 'vitest';
import {
    assembleInvestorFlowsSnapshot,
    buildInsiderStats,
    buildInsiderTransactions,
    buildInstitutionalQuarters,
    buildLargeHolders,
    buildShortInterest,
    buildShortVolume,
    buildTopHolders,
    inferLargeHolderForm,
    mapInsiderTransactionType,
    SNAPSHOT_MAX_QUARTERS,
    SNAPSHOT_MAX_TOP_HOLDERS,
    type AggregateRecord,
    type InvestorFlowsSnapshotInput,
} from '../../lib/investorFlowsSnapshot';

const NOW = new Date('2026-10-15T12:00:00Z');

const aggregate = (
    period: string,
    over: Partial<AggregateRecord> = {}
): AggregateRecord => ({
    period,
    holders: 10,
    shares: 1000,
    valueUsd: 50000,
    newHolders: 1,
    increased: 2,
    decreased: 3,
    exited: 4,
    netShareChange: -500,
    ...over,
});

const baseInput = (
    over: Partial<InvestorFlowsSnapshotInput> = {}
): InvestorFlowsSnapshotInput => ({
    now: NOW,
    aggregates: [],
    topHolders: [],
    exitedHolders: [],
    insiderTrades: [],
    insiderStats: [],
    beneficialOwnership: [],
    topHoldersPeriod: null,
    sharesFloat: null,
    shortInterest: [],
    shortVolume: [],
    ...over,
});

describe('buildInstitutionalQuarters', () => {
    it('orders oldest first and marks completeness by the filing deadline', () => {
        const quarters = buildInstitutionalQuarters(
            [aggregate('2026-09-30'), aggregate('2026-06-30')],
            '2026-10-15'
        );
        expect(quarters.map(q => [q.period, q.complete])).toEqual([
            ['2026-06-30', true],
            ['2026-09-30', false],
        ]);
    });

    describe('quarters without a prior-quarter baseline', () => {
        const noBaseline = (period: string) =>
            aggregate(period, {
                newHolders: null,
                increased: null,
                decreased: null,
                exited: null,
                netShareChange: null,
            });

        it('are never emitted — not with zero counts either (0 would read as "no change")', () => {
            expect(
                buildInstitutionalQuarters(
                    [noBaseline('2026-03-31')],
                    '2026-10-15'
                )
            ).toEqual([]);
        });

        it('are dropped individually while quarters with a baseline stay', () => {
            const quarters = buildInstitutionalQuarters(
                [
                    noBaseline('2026-03-31'),
                    aggregate('2026-06-30'),
                    noBaseline('2026-09-30'),
                ],
                '2026-10-15'
            );
            expect(quarters.map(q => q.period)).toEqual(['2026-06-30']);
        });

        it.each([
            'newHolders',
            'increased',
            'decreased',
            'exited',
            'netShareChange',
        ] as const)('are dropped when only %s is null', column => {
            const rows = [aggregate('2026-06-30', { [column]: null })];
            expect(buildInstitutionalQuarters(rows, '2026-10-15')).toEqual([]);
        });

        it('are not turned into a snapshot by themselves', () => {
            expect(
                assembleInvestorFlowsSnapshot(
                    baseInput({ aggregates: [noBaseline('2026-06-30')] })
                )
            ).toBeNull();
        });

        it('emit a real zero when a baseline exists and nothing changed', () => {
            const [q] = buildInstitutionalQuarters(
                [
                    aggregate('2026-06-30', {
                        newHolders: 0,
                        increased: 0,
                        decreased: 0,
                        exited: 0,
                        netShareChange: 0,
                    }),
                ],
                '2026-10-15'
            );
            expect(q).toMatchObject({ newHolders: 0, netShareChange: 0 });
        });
    });

    it('keeps the newest quarters when over the cap', () => {
        const periods = [
            '2022-03-31',
            '2022-06-30',
            '2022-09-30',
            '2022-12-31',
            '2023-03-31',
            '2023-06-30',
            '2023-09-30',
            '2023-12-31',
            '2024-03-31',
            '2024-06-30',
        ];
        const quarters = buildInstitutionalQuarters(
            periods.map(p => aggregate(p)),
            '2026-10-15'
        );
        expect(quarters).toHaveLength(SNAPSHOT_MAX_QUARTERS);
        expect(quarters[0]?.period).toBe('2022-09-30');
        expect(quarters.at(-1)?.period).toBe('2024-06-30');
    });
});

describe('buildTopHolders', () => {
    const held = (cik: string, shares: number, prevShares: number | null) => ({
        cik,
        filerName: `Filer ${cik}`,
        shares,
        valueUsd: shares * 10,
        prevShares,
    });

    it('classifies new, increased, decreased and unchanged by prior shares', () => {
        const holders = buildTopHolders(
            [
                held('1', 100, null),
                held('2', 100, 50),
                held('3', 100, 150),
                held('4', 100, 100),
            ],
            []
        );
        expect(holders.map(h => h.change)).toEqual([
            'new',
            'increased',
            'decreased',
            'unchanged',
        ]);
    });

    it('appends exited holders with zero shares and their prior shares', () => {
        const [exited] = buildTopHolders([], [held('9', 0, 777)]);
        expect(exited).toEqual({
            filerName: 'Filer 9',
            cik: '9',
            shares: 0,
            valueUsd: 0,
            prevShares: 777,
            change: 'exited',
        });
    });

    it('caps the held list', () => {
        const many = Array.from(
            { length: SNAPSHOT_MAX_TOP_HOLDERS + 5 },
            (_, i) => held(String(i), 10, 5)
        );
        expect(buildTopHolders(many, [])).toHaveLength(
            SNAPSHOT_MAX_TOP_HOLDERS
        );
    });
});

describe('insider mapping', () => {
    const row = (over: Record<string, unknown> = {}) => ({
        symbol: 'AAPL',
        filingDate: '2026-10-08',
        transactionDate: '2026-10-06',
        transactionType: 'S-Sale',
        reportingName: 'Newstead Jennifer',
        typeOfOwner: 'officer: SVP, GC and Government Affairs',
        securitiesTransacted: 2399,
        price: 332.01,
        url: 'https://www.sec.gov/x-index.htm',
        ...over,
    });

    it('carries securitiesOwned as sharesOwnedAfter (null when missing or negative)', () => {
        const [a, b, c] = buildInsiderTransactions([
            row({ securitiesOwned: 39593 }),
            row({ securitiesOwned: null, transactionDate: '2026-10-05' }),
            row({ securitiesOwned: -1, transactionDate: '2026-10-04' }),
        ]);
        expect([
            a?.sharesOwnedAfter,
            b?.sharesOwnedAfter,
            c?.sharesOwnedAfter,
        ]).toEqual([39593, null, null]);
    });

    it('maps P-Purchase to buy and S-Sale (including S-Sale+OE) to sell, everything else to other', () => {
        expect(mapInsiderTransactionType('P-Purchase')).toBe('buy');
        expect(mapInsiderTransactionType('S-Sale')).toBe('sell');
        expect(mapInsiderTransactionType('S-Sale+OE')).toBe('sell');
        expect(mapInsiderTransactionType('F-InKind')).toBe('other');
        expect(mapInsiderTransactionType('')).toBe('other');
        expect(mapInsiderTransactionType(null)).toBe('other');
    });

    it('builds a transaction with value = shares × price', () => {
        const [t] = buildInsiderTransactions([row()]);
        expect(t).toEqual({
            date: '2026-10-06',
            filingDate: '2026-10-08',
            name: 'Newstead Jennifer',
            role: 'officer: SVP, GC and Government Affairs',
            type: 'sell',
            shares: 2399,
            sharesOwnedAfter: null,
            price: 332.01,
            value: 796492,
            url: 'https://www.sec.gov/x-index.htm',
        });
    });

    it('leaves price and value null when the price is missing or zero', () => {
        const [t] = buildInsiderTransactions([row({ price: 0 })]);
        expect(t).toMatchObject({ price: null, value: null });
    });

    it('drops rows without a transacted share count or valid dates', () => {
        expect(
            buildInsiderTransactions([
                row({ securitiesTransacted: 0 }),
                row({ securitiesTransacted: null }),
                row({ transactionDate: null }),
            ])
        ).toEqual([]);
    });

    it('sorts newest transaction first', () => {
        const out = buildInsiderTransactions([
            row({ transactionDate: '2026-09-01' }),
            row({ transactionDate: '2026-10-01' }),
        ]);
        expect(out.map(t => t.date)).toEqual(['2026-10-01', '2026-09-01']);
    });

    it('keeps the latest eight quarters of statistics, oldest first', () => {
        const stats = Array.from({ length: 10 }, (_, i) => ({
            year: 2024 + Math.floor(i / 4),
            quarter: (i % 4) + 1,
            totalAcquired: i,
        }));
        const out = buildInsiderStats(stats);
        expect(out).toHaveLength(8);
        expect(out[0]?.period).toBe('2024-09-30');
        expect(out.at(-1)?.period).toBe('2026-06-30');
    });
});

describe('large holders (13D/G)', () => {
    it('infers the form from the filing URL', () => {
        expect(
            inferLargeHolderForm(
                'https://x/xslSCHEDULE_13G_X02/primary_doc.xml'
            )
        ).toBe('SC 13G');
        expect(inferLargeHolderForm('https://x/d667611dsc13ga.htm')).toBe(
            'SC 13G'
        );
        expect(
            inferLargeHolderForm(
                'https://x/xslSCHEDULE_13D_X01/primary_doc.xml'
            )
        ).toBe('SC 13D');
        expect(
            inferLargeHolderForm('https://x/tv0062-ftaiaviationltd.htm')
        ).toBe('unknown');
        expect(inferLargeHolderForm(null)).toBe('unknown');
    });

    it('parses the string numbers FMP returns and keeps a legitimate 0%', () => {
        const [h] = buildLargeHolders(
            [
                {
                    filingDate: '2026-09-03',
                    nameOfReportingPerson: 'The Vanguard Group',
                    amountBeneficiallyOwned: '0',
                    percentOfClass: '0',
                    form: 'SCHEDULE 13G/A',
                    url: 'https://x/xslSCHEDULE_13G_X02/primary_doc.xml',
                },
            ],
            '2026-10-15'
        );
        expect(h).toEqual({
            filingDate: '2026-09-03',
            filer: 'The Vanguard Group',
            form: 'SCHEDULE 13G/A',
            percentOfClass: 0,
            shares: 0,
            url: 'https://x/xslSCHEDULE_13G_X02/primary_doc.xml',
        });
    });

    it('maps non-numeric strings to null', () => {
        const [h] = buildLargeHolders(
            [
                {
                    filingDate: '2026-09-03',
                    percentOfClass: 'n/a',
                    amountBeneficiallyOwned: '',
                },
            ],
            '2026-10-15'
        );
        expect(h).toMatchObject({ percentOfClass: null, shares: null });
    });
});

describe('large holder form', () => {
    const base = {
        filingDate: '2026-04-29',
        nameOfReportingPerson: 'X',
        url: 'https://x/xslSCHEDULE_13G_X02/primary_doc.xml',
    };

    it('uses the exact SEC form when the lookup resolved it (amendments included)', () => {
        const [h] = buildLargeHolders(
            [{ ...base, form: 'SC 13D/A' }],
            '2026-10-15'
        );
        expect(h?.form).toBe('SC 13D/A');
    });

    it('falls back to the URL token only when the SEC lookup failed', () => {
        const [h] = buildLargeHolders(
            [{ ...base, formLookupFailed: true }],
            '2026-10-15'
        );
        expect(h?.form).toBe('SC 13G');
    });

    it('stays unknown when the lookup succeeded but did not list the accession (no guessing from the URL)', () => {
        const [h] = buildLargeHolders([base], '2026-10-15');
        expect(h?.form).toBe('unknown');
    });

    it('stays unknown on lookup failure when the URL carries no schedule token either', () => {
        const [h] = buildLargeHolders(
            [
                {
                    ...base,
                    url: 'https://x/tv0062-ftaiaviationltd.htm',
                    formLookupFailed: true,
                },
            ],
            '2026-10-15'
        );
        expect(h?.form).toBe('unknown');
    });
});

describe('large holder window and stats shape', () => {
    const filing = (filingDate: string) => ({
        filingDate,
        nameOfReportingPerson: 'X',
        url: 'https://x/13g.htm',
    });

    it('keeps only filings from the last two years (730 days)', () => {
        // 2026-10-15 − 730d = 2024-10-15
        const out = buildLargeHolders(
            [filing('2024-10-15'), filing('2024-10-14')],
            '2026-10-15'
        );
        expect(out.map(h => h.filingDate)).toEqual(['2024-10-15']);
    });

    it('maps a quarter number to its quarter-end period', () => {
        const [stat] = buildInsiderStats([
            {
                year: 2026,
                quarter: 1,
                acquiredTransactions: 5,
                totalDisposed: 9,
            },
        ]);
        expect(stat).toEqual({
            period: '2026-03-31',
            acquiredTransactions: 5,
            disposedTransactions: 0,
            totalAcquired: 0,
            totalDisposed: 9,
        });
    });

    it('drops statistics rows with an impossible quarter', () => {
        expect(buildInsiderStats([{ year: 2026, quarter: 5 }])).toEqual([]);
    });
});

describe('short series', () => {
    it('orders short interest oldest first and caps to the newest points', () => {
        const rows = Array.from({ length: 15 }, (_, i) => ({
            settlementDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
            shortQty: i,
            avgDailyVolume: null,
            daysToCover: null,
        })).reverse();
        const out = buildShortInterest(rows);
        expect(out).toHaveLength(12);
        expect(out[0]?.shortQty).toBe(3);
        expect(out.at(-1)?.shortQty).toBe(14);
    });

    it('renames tradeDate to date for the short volume series', () => {
        expect(
            buildShortVolume([
                { tradeDate: '2026-10-14', shortVolume: 5, totalVolume: 10 },
            ])
        ).toEqual([{ date: '2026-10-14', shortVolume: 5, totalVolume: 10 }]);
    });
});

describe('assembleInvestorFlowsSnapshot', () => {
    it('returns null when no source has data', () => {
        expect(assembleInvestorFlowsSnapshot(baseInput())).toBeNull();
    });

    it('does not treat FINRA being off (null series) as data', () => {
        expect(
            assembleInvestorFlowsSnapshot(
                baseInput({ shortInterest: null, shortVolume: null })
            )
        ).toBeNull();
    });

    it('carries null short series through when FINRA is off but other data exists', () => {
        const snapshot = assembleInvestorFlowsSnapshot(
            baseInput({
                aggregates: [aggregate('2026-06-30')],
                shortInterest: null,
                shortVolume: null,
            })
        );
        expect(snapshot?.shortInterest).toBeNull();
        expect(snapshot?.shortVolume).toBeNull();
    });

    it('distinguishes an empty FINRA series ([]) from a switched-off one (null)', () => {
        const snapshot = assembleInvestorFlowsSnapshot(
            baseInput({
                aggregates: [aggregate('2026-06-30')],
                shortInterest: [],
                shortVolume: [],
            })
        );
        expect(snapshot?.shortInterest).toEqual([]);
        expect(snapshot?.shortVolume).toEqual([]);
    });

    it('fills shares outstanding, float and asOf', () => {
        const snapshot = assembleInvestorFlowsSnapshot(
            baseInput({
                aggregates: [aggregate('2026-06-30')],
                sharesFloat: {
                    floatShares: 14576876685,
                    outstandingShares: 14594180000,
                },
            })
        );
        expect(snapshot).toMatchObject({
            asOf: '2026-10-15T12:00:00.000Z',
            sharesOutstanding: 14594180000,
            floatShares: 14576876685,
        });
    });

    it('sets largeHolders to null (not []) when the 13D/G fetch failed, and that alone is not data', () => {
        expect(
            assembleInvestorFlowsSnapshot(
                baseInput({ beneficialOwnership: null })
            )
        ).toBeNull();
        const snapshot = assembleInvestorFlowsSnapshot(
            baseInput({
                aggregates: [aggregate('2026-06-30')],
                beneficialOwnership: null,
            })
        );
        expect(snapshot?.largeHolders).toBeNull();
    });

    it('supplies topHoldersPeriod from the data', () => {
        const snapshot = assembleInvestorFlowsSnapshot(
            baseInput({
                aggregates: [aggregate('2026-06-30')],
                topHoldersPeriod: '2026-06-30',
            })
        );
        expect(snapshot?.institutional.topHoldersPeriod).toBe('2026-06-30');
    });

    it('yields a snapshot from FMP-only data (no 13F yet)', () => {
        const snapshot = assembleInvestorFlowsSnapshot(
            baseInput({
                beneficialOwnership: [
                    {
                        filingDate: '2026-04-29',
                        nameOfReportingPerson: 'X',
                        url: 'https://x/13g.htm',
                    },
                ],
            })
        );
        expect(snapshot?.institutional.quarters).toEqual([]);
        expect(snapshot?.largeHolders).toHaveLength(1);
        expect(snapshot?.institutional.topHoldersPeriod).toBeNull();
    });
});
