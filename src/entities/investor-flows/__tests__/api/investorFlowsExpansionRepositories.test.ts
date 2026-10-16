import { describe, expect, it, vi } from 'vitest';
import {
    investorFlowsState,
    regShoThreshold,
    secCikSymbolMap,
    secFilingsFailures,
    secForm144,
    secFtd,
    secFtdFiles,
    secOfferingFilings,
} from '@/shared/db/schema';
import { DrizzleSecFilingsRepository } from '../../api/investorFlowsFilingsRepository';
import { DrizzleInvestorFlowsFtdRepository } from '../../api/investorFlowsFtdRepository';
import { DrizzleInvestorFlowsRegShoRepository } from '../../api/investorFlowsRegShoRepository';
import {
    readInvestorFlowsState,
    writeInvestorFlowsState,
} from '../../api/investorFlowsState';
import { callsOf, createFakeDb, renderSql } from '../fixtures/fakeDb';

vi.mock('server-only', () => ({}));

const withCount = (count: number) => ({ count });

describe('investorFlowsState helpers', () => {
    it('reads a key’s value (null when absent)', async () => {
        const { db } = createFakeDb([[{ value: '2026-10-15' }], []]);
        expect(await readInvestorFlowsState(db, 'k')).toBe('2026-10-15');
        expect(await readInvestorFlowsState(db, 'missing')).toBeNull();
    });

    it('upserts a key with a refreshed updated_at', async () => {
        const { db, ops } = createFakeDb();
        await writeInvestorFlowsState(db, 'sec_filings_cursor', '2026-10-15');
        expect(ops[0]?.target).toBe(investorFlowsState);
        const [[values]] = callsOf(ops[0] as never, 'values') as [[unknown]];
        expect(values).toEqual({
            key: 'sec_filings_cursor',
            value: '2026-10-15',
        });
    });
});

describe('DrizzleSecFilingsRepository', () => {
    it('groups the CIK map into CIK → symbols', async () => {
        const { db } = createFakeDb([
            [
                { cik: 1652044, symbol: 'GOOG' },
                { cik: 1652044, symbol: 'GOOGL' },
                { cik: 2488, symbol: 'AMD' },
            ],
        ]);
        expect([
            ...(await new DrizzleSecFilingsRepository(db).loadCikSymbols()),
        ]).toEqual([
            [1652044, ['GOOG', 'GOOGL']],
            [2488, ['AMD']],
        ]);
    });

    it('replaces the CIK map: upserts every pair then deletes the rows not refreshed in this transaction', async () => {
        const { db, ops } = createFakeDb([[], withCount(4)]);
        const result = await new DrizzleSecFilingsRepository(
            db
        ).replaceCikSymbolMap([{ cik: 2488, symbol: 'AMD' }]);
        expect(result).toEqual({ upserted: 1, deleted: 4 });
        expect(ops[0]?.target).toBe(secCikSymbolMap);
        expect(renderSql(ops[1]?.target as never).text).toBe(
            'DELETE FROM sec_cik_symbol_map WHERE updated_at < now()'
        );
    });

    it('finds stored Form 144 and offering accessions', async () => {
        const { db } = createFakeDb([
            [{ accession: 'A' }],
            [{ accession: 'B' }],
        ]);
        const repo = new DrizzleSecFilingsRepository(db);
        expect(await repo.findStoredForm144(['A', 'X'])).toEqual(
            new Set(['A'])
        );
        expect(await repo.findStoredOfferings(['B', 'Y'])).toEqual(
            new Set(['B'])
        );
    });

    it('returns the attempts of queued failures', async () => {
        const { db } = createFakeDb([[{ accession: 'A', attempts: 2 }]]);
        expect([
            ...(await new DrizzleSecFilingsRepository(db).findFailureAttempts([
                'A',
            ])),
        ]).toEqual([['A', 2]]);
    });

    it('stores Form 144 rows idempotently and clears their retry records in the same transaction', async () => {
        const { db, ops } = createFakeDb();
        await new DrizzleSecFilingsRepository(db).upsertForm144([
            {
                accession: 'A',
                issuerCik: 2488,
                symbol: 'AMD',
                filerName: 'F',
                filerCik: null,
                relationships: ['Officer'],
                securityClass: 'Common',
                shares: 1,
                valueUsd: 2,
                sharesOutstanding: null,
                approxSaleDate: null,
                planAdoptionDate: null,
                broker: null,
                formType: '144',
                filingDate: '2026-10-15',
            },
        ]);
        expect(ops.map(op => [op.kind, op.target])).toEqual([
            ['insert', secForm144],
            ['delete', secFilingsFailures],
        ]);
        expect(callsOf(ops[0] as never, 'onConflictDoNothing')).toHaveLength(1);
    });

    it('does nothing for empty batches', async () => {
        const { db, ops } = createFakeDb();
        const repo = new DrizzleSecFilingsRepository(db);
        await repo.upsertForm144([]);
        await repo.upsertOfferings([]);
        expect(ops).toEqual([]);
    });

    it('updates an offering’s kind only when it changed and clears the accession’s retry record', async () => {
        const { db, ops } = createFakeDb();
        await new DrizzleSecFilingsRepository(db).upsertOfferings([
            {
                accession: 'A',
                symbol: 'LEN',
                issuerCik: 920760,
                formType: '424B5',
                filingDate: '2026-10-15',
                kind: 'atm',
                url: 'u',
            },
        ]);
        expect(ops[0]?.target).toBe(secOfferingFilings);
        const [[config]] = callsOf(ops[0] as never, 'onConflictDoUpdate') as [
            [{ setWhere: Parameters<typeof renderSql>[0] }],
        ];
        expect(renderSql(config.setWhere).text).toContain(
            'IS DISTINCT FROM excluded.kind'
        );
        expect(ops[1]).toMatchObject({
            kind: 'delete',
            target: secFilingsFailures,
        });
    });

    it('records a failure with the numeric CIK and increments attempts on conflict', async () => {
        const { db, ops } = createFakeDb();
        await new DrizzleSecFilingsRepository(db).recordFailure(
            {
                accession: 'A',
                cik: '0000002488',
                formType: '144',
                filingDate: '2026-10-15',
            },
            'timeout'
        );
        const [[values]] = callsOf(ops[0] as never, 'values') as [[unknown]];
        expect(values).toEqual({
            accession: 'A',
            cik: 2488,
            formType: '144',
            filingDate: '2026-10-15',
            attempts: 1,
            lastError: 'timeout',
        });
    });

    it('lists retries with a ten-digit CIK', async () => {
        const { db } = createFakeDb([
            [
                {
                    accession: 'A',
                    cik: 2488,
                    formType: '424B5',
                    filingDate: '2026-10-15',
                    attempts: 1,
                },
            ],
        ]);
        expect(
            await new DrizzleSecFilingsRepository(db).listRetries(3, 50)
        ).toEqual([
            {
                accession: 'A',
                cik: '0000002488',
                formType: '424B5',
                filingDate: '2026-10-15',
                attempts: 1,
            },
        ]);
    });

    it('prunes the three tables by their own cutoff', async () => {
        const { db, ops } = createFakeDb([
            withCount(1),
            withCount(2),
            withCount(3),
        ]);
        expect(
            await new DrizzleSecFilingsRepository(db).pruneBefore({
                form144Before: '2025-10-15',
                offeringsBefore: '2024-10-15',
                failuresBefore: '2025-10-16',
            })
        ).toEqual({ form144: 1, offerings: 2, failures: 3 });
        expect(ops.map(op => renderSql(op.target as never).params)).toEqual([
            ['2025-10-15'],
            ['2024-10-15'],
            ['2025-10-16'],
        ]);
    });

    it('reads proposed sales through the issuer CIK of the symbol and links the filing index', async () => {
        const { db, ops } = createFakeDb([
            [
                {
                    accession: '0001950047-26-010251',
                    issuerCik: 2488,
                    filingDate: '2026-10-15',
                    formType: '144',
                    filerName: 'FORREST E NORROD',
                    relationships: ['Officer'],
                    shares: 17262,
                    valueUsd: 9333573,
                    approxSaleDate: '2026-10-15',
                    planAdoptionDate: '2026-05-20',
                },
            ],
        ]);
        const sales = await new DrizzleSecFilingsRepository(
            db
        ).findProposedSales('AMD', '2026-04-15', 5);
        expect(sales[0]).toMatchObject({
            filer: 'FORREST E NORROD',
            url: 'https://www.sec.gov/Archives/edgar/data/2488/000195004726010251/0001950047-26-010251-index.htm',
        });
        const [[where]] = callsOf(ops[0] as never, 'where') as [
            [Parameters<typeof renderSql>[0]],
        ];
        const rendered = renderSql(where);
        expect(rendered.text).toContain(
            'IN (SELECT cik FROM sec_cik_symbol_map WHERE symbol = $2)'
        );
        expect(rendered.params).toEqual(['2026-04-15', 'AMD']);
        expect(callsOf(ops[0] as never, 'limit')).toEqual([[5]]);
    });

    it('reads a symbol’s offerings', async () => {
        const { db } = createFakeDb([
            [
                {
                    accession: 'A',
                    filingDate: '2026-10-15',
                    formType: 'S-3',
                    kind: 'shelf',
                    url: 'u',
                },
            ],
        ]);
        expect(
            await new DrizzleSecFilingsRepository(db).findOfferings(
                'NBRU',
                '2026-04-15',
                5
            )
        ).toEqual([
            {
                accession: 'A',
                filingDate: '2026-10-15',
                formType: 'S-3',
                kind: 'shelf',
                url: 'u',
            },
        ]);
    });

    it('reads an unknown stored kind as other', async () => {
        const { db } = createFakeDb([
            [
                {
                    accession: 'A',
                    filingDate: '2026-10-15',
                    formType: 'S-3',
                    kind: 'mystery',
                    url: 'u',
                },
            ],
        ]);
        expect(
            (
                await new DrizzleSecFilingsRepository(db).findOfferings(
                    'NBRU',
                    '2026-04-15',
                    5
                )
            )[0]?.kind
        ).toBe('other');
    });

    it('counts exhausted failures, leaving out the negative markers', async () => {
        const { db, ops } = createFakeDb([[{ n: 51 }]]);
        expect(
            await new DrizzleSecFilingsRepository(db).countExhaustedFailures(3)
        ).toBe(51);
        const [[where]] = callsOf(ops[0] as never, 'where') as [
            [Parameters<typeof renderSql>[0]],
        ];
        const rendered = renderSql(where);
        expect(rendered.text).toContain('"skipped" = $2');
        expect(rendered.params).toEqual([3, false]);
    });

    it('records a negative marker: skipped, attempts already exhausted', async () => {
        const { db, ops } = createFakeDb();
        await new DrizzleSecFilingsRepository(db).recordSkipped(
            {
                accession: 'A',
                cik: '0001650372',
                formType: '144',
                filingDate: '2026-10-15',
            },
            'issuer CIK 1552033 is outside the universe',
            3
        );
        const [[values]] = callsOf(ops[0] as never, 'values') as [[unknown]];
        expect(values).toEqual({
            accession: 'A',
            cik: 1650372,
            formType: '144',
            filingDate: '2026-10-15',
            attempts: 3,
            lastError: 'issuer CIK 1552033 is outside the universe',
            skipped: true,
        });
    });
});

describe('DrizzleInvestorFlowsFtdRepository', () => {
    it('lists file states: stored when processed_at is set, plus the failed attempts', async () => {
        const { db } = createFakeDb([
            [
                { fileKey: '202609b', processedAt: new Date(), attempts: 0 },
                { fileKey: '202609a', processedAt: null, attempts: 2 },
            ],
        ]);
        expect([
            ...(await new DrizzleInvestorFlowsFtdRepository(
                db
            ).listFileStates()),
        ]).toEqual([
            ['202609b', { processed: true, attempts: 0 }],
            ['202609a', { processed: false, attempts: 2 }],
        ]);
    });

    it('hasAnyProcessedFile is true once a processed file exists (one LIMIT 1 probe of the file markers)', async () => {
        const { db, ops } = createFakeDb([[{ fileKey: '202609b' }]]);
        expect(
            await new DrizzleInvestorFlowsFtdRepository(
                db
            ).hasAnyProcessedFile()
        ).toBe(true);
        expect(callsOf(ops[0] as never, 'from')).toEqual([[secFtdFiles]]);
        expect(callsOf(ops[0] as never, 'limit')).toEqual([[1]]);
        expect(callsOf(ops[0] as never, 'where')).toHaveLength(1);
    });

    it('hasAnyProcessedFile is false when no file has been stored', async () => {
        const { db } = createFakeDb([[]]);
        expect(
            await new DrizzleInvestorFlowsFtdRepository(
                db
            ).hasAnyProcessedFile()
        ).toBe(false);
    });

    it('records a rejected file by counting an attempt without marking it processed', async () => {
        const { db, ops } = createFakeDb();
        await new DrizzleInvestorFlowsFtdRepository(db).recordRejected(
            '202609b',
            'trailer mismatch'
        );
        expect(ops[0]?.target).toBe(secFtdFiles);
        const [[values]] = callsOf(ops[0] as never, 'values') as [[unknown]];
        expect(values).toEqual({
            fileKey: '202609b',
            attempts: 1,
            lastError: 'trailer mismatch',
        });
        const [[config]] = callsOf(ops[0] as never, 'onConflictDoUpdate') as [
            [{ set: Record<string, unknown> }],
        ];
        expect(Object.keys(config.set).sort()).toEqual([
            'attempts',
            'lastError',
        ]);
    });

    it('stores a file’s rows (numeric price as text) and then its marker, in one transaction', async () => {
        const { db, ops } = createFakeDb();
        await new DrizzleInvestorFlowsFtdRepository(db).storeFile('202609b', [
            {
                cusip: '084670702',
                settlementDate: '2026-09-15',
                symbol: 'BRK.B',
                failsQty: 4357,
                price: 514.95,
            },
            {
                cusip: '084670702',
                settlementDate: '2026-09-16',
                symbol: 'BRK.B',
                failsQty: 1,
                price: null,
            },
        ]);
        expect(ops.map(op => op.target)).toEqual([secFtd, secFtdFiles]);
        const [[rows]] = callsOf(ops[0] as never, 'values') as [[unknown]];
        expect(rows).toEqual([
            {
                cusip: '084670702',
                settlementDate: '2026-09-15',
                symbol: 'BRK.B',
                failsQty: 4357,
                price: '514.95',
            },
            {
                cusip: '084670702',
                settlementDate: '2026-09-16',
                symbol: 'BRK.B',
                failsQty: 1,
                price: null,
            },
        ]);
        const [[marker]] = callsOf(ops[1] as never, 'values') as [[unknown]];
        expect(marker).toMatchObject({ fileKey: '202609b', rowCount: 2 });
        expect(
            renderSql((marker as { processedAt: never }).processedAt).text
        ).toBe('now()');
    });

    it('sums by settlement date for a symbol and converts the text columns', async () => {
        const { db, ops } = createFakeDb([
            [{ settlement_date: '2026-09-15', fails_qty: '300', price: null }],
        ]);
        expect(
            await new DrizzleInvestorFlowsFtdRepository(db).findFailsToDeliver(
                'AAPL',
                '2026-04-01'
            )
        ).toEqual([
            { settlementDate: '2026-09-15', failsQty: 300, price: null },
        ]);
        const { text, params } = renderSql(ops[0]?.target as never);
        expect(text).toContain('sum(fails_qty)');
        expect(text).toContain('GROUP BY settlement_date');
        expect(params).toEqual(['AAPL', '2026-04-01']);
    });

    it('prunes by settlement date', async () => {
        const { db } = createFakeDb([withCount(9)]);
        expect(
            await new DrizzleInvestorFlowsFtdRepository(db).pruneBefore(
                '2024-10-16'
            )
        ).toBe(9);
    });
});

describe('DrizzleInvestorFlowsRegShoRepository', () => {
    it('inserts listings and ignores duplicates', async () => {
        const { db, ops } = createFakeDb();
        await new DrizzleInvestorFlowsRegShoRepository(db).insertListings([
            { symbol: 'GME', tradeDate: '2026-10-15', market: 'nyse' },
        ]);
        expect(ops[0]?.target).toBe(regShoThreshold);
        expect(callsOf(ops[0] as never, 'onConflictDoNothing')).toHaveLength(1);
    });

    it('groups listings per trade date', async () => {
        const { db } = createFakeDb([
            [
                { tradeDate: '2026-10-15', market: 'cboe_bzx' },
                { tradeDate: '2026-10-15', market: 'nyse' },
            ],
        ]);
        expect(
            await new DrizzleInvestorFlowsRegShoRepository(db).findListings(
                'GME',
                '2026-10-01'
            )
        ).toEqual([{ tradeDate: '2026-10-15', markets: ['cboe_bzx', 'nyse'] }]);
    });

    it('reads the ingested trade dates from the cursor state (a broken value reads as none)', async () => {
        const { db } = createFakeDb([
            [
                {
                    value: '{"lastByMarket":{},"ingestedDates":["2026-10-14","2026-10-15"]}',
                },
            ],
            [{ value: 'not json' }],
        ]);
        const repo = new DrizzleInvestorFlowsRegShoRepository(db);
        expect(await repo.listTradeDates('2026-10-15')).toEqual(['2026-10-15']);
        expect(await repo.listTradeDates('2026-10-01')).toEqual([]);
    });

    it('prunes by trade date', async () => {
        const { db } = createFakeDb([withCount(3)]);
        expect(
            await new DrizzleInvestorFlowsRegShoRepository(db).pruneBefore(
                '2026-04-19'
            )
        ).toBe(3);
    });
});
