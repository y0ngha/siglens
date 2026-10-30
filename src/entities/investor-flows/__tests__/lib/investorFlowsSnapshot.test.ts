import { describe, expect, it } from 'vitest';
import {
    assembleInvestorFlowsSnapshot,
    type InvestorFlowsSnapshotInput,
} from '../../lib/investorFlowsSnapshot';
import {
    buildFailsToDeliver,
    buildThresholdList,
    buildShortInterest,
    buildShortVolume,
    SNAPSHOT_MAX_FTD_POINTS,
} from '../../lib/snapshot/short';
import {
    buildOfferings,
    buildProposedSales,
    SNAPSHOT_MAX_OFFERINGS,
    SNAPSHOT_MAX_PROPOSED_SALES,
} from '../../lib/snapshot/filings';
import {
    buildOptionQuarters,
    buildInstitutionalQuarters,
    buildTopHolders,
    SNAPSHOT_MAX_QUARTERS,
    SNAPSHOT_MAX_TOP_HOLDERS,
    type AggregateRecord,
} from '../../lib/snapshot/institutional';
import {
    buildInsiderStats,
    buildInsiderTransactions,
    mapInsiderTransactionType,
} from '../../lib/snapshot/insider';
import {
    buildLargeHolders,
    inferLargeHolderForm,
} from '../../lib/snapshot/largeHolders';
import type {
    OfferingRecord,
    OptionAggregateRecord,
    ProposedSaleRecord,
} from '../../model';

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
    failsToDeliver: [],
    proposedSales: [],
    offerings: [],
    optionAggregates: [],
    thresholdList: null,
    ...over,
});

const sale = (
    filingDate: string,
    over: Partial<ProposedSaleRecord> = {}
): ProposedSaleRecord => ({
    accession: `acc-${filingDate}`,
    filingDate,
    formType: '144',
    filer: 'Fixture Officer',
    filerCik: '0001622864',
    relationships: ['Officer'],
    shares: 1200,
    valueUsd: 250_000,
    approxSaleDate: filingDate,
    planAdoptionDate: null,
    url: `https://www.sec.gov/${filingDate}`,
    ...over,
});

const offering = (
    filingDate: string,
    over: Partial<OfferingRecord> = {}
): OfferingRecord => ({
    accession: `acc-${filingDate}`,
    filingDate,
    formType: '424B5',
    kind: 'atm',
    url: `https://www.sec.gov/o-${filingDate}`,
    ...over,
});

const optionAggregate = (period: string): OptionAggregateRecord => ({
    period,
    putHolders: 3,
    putShares: 900,
    putValueUsd: 90_000,
    callHolders: 4,
    callShares: 1100,
    callValueUsd: 110_000,
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

describe('SEC expansion builders', () => {
    it('buildFailsToDeliver sorts oldest first and keeps the newest SNAPSHOT_MAX_FTD_POINTS days', () => {
        const rows = Array.from(
            { length: SNAPSHOT_MAX_FTD_POINTS + 3 },
            (_, i) => ({
                settlementDate: `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
                failsQty: 1000 + i,
                price: i === 0 ? null : 10,
            })
        ).reverse();
        const points = buildFailsToDeliver(rows);
        expect(points).toHaveLength(SNAPSHOT_MAX_FTD_POINTS);
        expect(points[0].failsQty).toBe(1003);
        expect(points.at(-1)?.failsQty).toBe(
            1000 + SNAPSHOT_MAX_FTD_POINTS + 2
        );
    });

    it('buildFailsToDeliver keeps a missing price as null', () => {
        expect(
            buildFailsToDeliver([
                { settlementDate: '2026-09-01', failsQty: 5, price: null },
            ])[0].price
        ).toBeNull();
    });

    it('buildProposedSales orders newest first, caps the list and maps to the core shape', () => {
        const rows = Array.from(
            { length: SNAPSHOT_MAX_PROPOSED_SALES + 2 },
            (_, i) =>
                sale(
                    `2026-0${(i % 9) + 1}-${String((i % 27) + 1).padStart(2, '0')}`,
                    {
                        accession: `a${i}`,
                    }
                )
        );
        const sales = buildProposedSales(rows, '2026-10-15');
        expect(sales).toHaveLength(SNAPSHOT_MAX_PROPOSED_SALES);
        expect(sales[0].filingDate >= sales[1].filingDate).toBe(true);
        expect(Object.keys(sales[0]).sort()).toEqual(
            [
                'approxSaleDate',
                'filer',
                'filerCik',
                'filingDate',
                'formType',
                'planAdoptionDate',
                'relationships',
                'shares',
                'url',
                'valueUsd',
            ].sort()
        );
    });

    it('buildProposedSales carries the 10b5-1 plan date', () => {
        expect(
            buildProposedSales(
                [sale('2026-10-01', { planAdoptionDate: '2026-05-02' })],
                '2026-10-15'
            )[0].planAdoptionDate
        ).toBe('2026-05-02');
    });

    it('buildProposedSales exempts the same 90-day window the counts use when the snapshot day is a weekend', () => {
        // 2026-10-17 is a Saturday: windowTo = Fri 10-16, 90d window starts 07-19 (not 07-20).
        const recent = Array.from(
            { length: SNAPSHOT_MAX_PROPOSED_SALES },
            (_, i) => sale('2026-10-10', { accession: `r${i}` })
        );
        const edge = sale('2026-07-19', { accession: 'edge' });
        const before = sale('2026-07-18', { accession: 'before' });
        const sales = buildProposedSales(
            [...recent, edge, before],
            '2026-10-17'
        );
        expect(sales).toHaveLength(SNAPSHOT_MAX_PROPOSED_SALES + 1);
        expect(sales.at(-1)?.filingDate).toBe('2026-07-19');
    });

    it('buildProposedSales carries the form type and keeps every row inside the 90-day count window past the cap', () => {
        const recent = Array.from(
            { length: SNAPSHOT_MAX_PROPOSED_SALES + 5 },
            (_, i) => sale('2026-10-10', { accession: `r${i}` })
        );
        const old = sale('2026-01-02', {
            accession: 'old',
            formType: '144/A',
        });
        const sales = buildProposedSales([...recent, old], '2026-10-15');
        expect(sales).toHaveLength(SNAPSHOT_MAX_PROPOSED_SALES + 5);
        expect(sales.every(s => s.formType === '144')).toBe(true);
        expect(buildProposedSales([old], '2026-10-15')[0].formType).toBe(
            '144/A'
        );
    });

    it('buildOfferings renames formType to form, keeps the kind and caps newest first', () => {
        const rows = Array.from(
            { length: SNAPSHOT_MAX_OFFERINGS + 1 },
            (_, i) =>
                offering(
                    `2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
                    {
                        accession: `o${i}`,
                        kind: i === 0 ? 'shelf' : 'atm',
                    }
                )
        );
        const filings = buildOfferings(rows);
        expect(filings).toHaveLength(SNAPSHOT_MAX_OFFERINGS);
        expect(filings[0]).toEqual({
            filingDate: filings[0].filingDate,
            form: '424B5',
            kind: expect.any(String),
            url: expect.stringContaining('https://www.sec.gov/'),
        });
        expect(filings[0].filingDate >= filings[1].filingDate).toBe(true);
    });

    it('buildOptionQuarters orders oldest first and marks an in-progress quarter incomplete', () => {
        const quarters = buildOptionQuarters(
            [optionAggregate('2026-09-30'), optionAggregate('2026-06-30')],
            '2026-10-15'
        );
        expect(quarters.map(q => [q.period, q.complete])).toEqual([
            ['2026-06-30', true],
            ['2026-09-30', false],
        ]);
        expect(quarters[0].putValueUsd).toBe(90_000);
        expect(quarters[0].callHolders).toBe(4);
    });

    it('buildThresholdList returns null when no list was ingested (unknown, not "not listed")', () => {
        expect(
            buildThresholdList({
                listed: false,
                consecutiveDays: 0,
                firstListedDate: null,
                markets: [],
                asOf: null,
            })
        ).toBeNull();
    });

    it('buildThresholdList carries the list date as asOf so core can drop a stale status', () => {
        expect(
            buildThresholdList({
                listed: true,
                consecutiveDays: 14,
                firstListedDate: '2026-09-25',
                markets: ['Nasdaq'],
                asOf: '2026-10-14',
            })
        ).toEqual({
            listed: true,
            consecutiveDays: 14,
            firstListedDate: '2026-09-25',
            markets: ['Nasdaq'],
            asOf: '2026-10-14',
        });
    });
});

describe('assembleInvestorFlowsSnapshot — SEC expansion fields', () => {
    const listed = {
        listed: true,
        consecutiveDays: 3,
        firstListedDate: '2026-10-10',
        markets: ['NYSE'],
        asOf: '2026-10-14',
    };

    it('counts FTD, Form 144, offerings, options and a listing as data on their own', () => {
        for (const over of [
            {
                failsToDeliver: [
                    { settlementDate: '2026-09-01', failsQty: 1, price: 1 },
                ],
            },
            { proposedSales: [sale('2026-10-01')] },
            { offerings: [offering('2026-10-01')] },
            { optionAggregates: [optionAggregate('2026-06-30')] },
            { thresholdList: listed },
        ] satisfies Partial<InvestorFlowsSnapshotInput>[]) {
            expect(
                assembleInvestorFlowsSnapshot(baseInput(over))
            ).not.toBeNull();
        }
    });

    it('maps the stored filer CIK onto ProposedSale.filerCik (core counts filers by CIK)', () => {
        const snapshot = assembleInvestorFlowsSnapshot(
            baseInput({
                proposedSales: [
                    sale('2026-10-01'),
                    sale('2026-10-02', { filerCik: null }),
                ],
            })
        );
        expect(snapshot?.proposedSales?.map(p => p.filerCik)).toEqual([
            null,
            '0001622864',
        ]);
    });

    it('does not count a "not listed" threshold status as data', () => {
        expect(
            assembleInvestorFlowsSnapshot(
                baseInput({ thresholdList: { ...listed, listed: false } })
            )
        ).toBeNull();
    });

    it('passes FTD null through and omits failed Form 144 / offering / option fields', () => {
        const snapshot = assembleInvestorFlowsSnapshot(
            baseInput({
                aggregates: [aggregate('2026-06-30')],
                failsToDeliver: null,
                proposedSales: null,
                offerings: null,
                optionAggregates: null,
            })
        );
        expect(snapshot?.failsToDeliver).toBeNull();
        expect(snapshot && 'proposedSales' in snapshot).toBe(false);
        expect(snapshot && 'offerings' in snapshot).toBe(false);
        expect(snapshot && 'options' in snapshot.institutional).toBe(false);
    });

    it('fills every expansion field when present', () => {
        const snapshot = assembleInvestorFlowsSnapshot(
            baseInput({
                aggregates: [aggregate('2026-06-30')],
                proposedSales: [sale('2026-10-01')],
                offerings: [offering('2026-09-01')],
                optionAggregates: [optionAggregate('2026-06-30')],
                thresholdList: listed,
            })
        );
        expect(snapshot?.proposedSales).toHaveLength(1);
        expect(snapshot?.offerings?.[0].form).toBe('424B5');
        expect(snapshot?.institutional.options).toHaveLength(1);
        expect(snapshot?.thresholdList).toEqual(listed);
        expect(snapshot?.failsToDeliver).toEqual([]);
    });

    it('passes a switched-off threshold list as null', () => {
        const snapshot = assembleInvestorFlowsSnapshot(
            baseInput({ aggregates: [aggregate('2026-06-30')] })
        );
        expect(snapshot?.thresholdList).toBeNull();
    });
});
