import { describe, expect, it, vi } from 'vitest';
import {
    cusipSymbolMap,
    finraShortInterest,
    finraShortVolume,
    sec13fOptionAggregates,
} from '@/shared/db/schema';
import { DrizzleInvestorFlowsShortRepository } from '../../api/investorFlowsShortRepository';
import { DrizzleInvestorFlowsSnapshotRepository } from '../../api/investorFlowsSnapshotRepository';
import { DrizzleInvestorFlowsUniverseRepository } from '../../api/investorFlowsUniverseRepository';
import { INVESTOR_FLOWS_US_EXCHANGES } from '../../lib/investorFlowsPolicy';
import { callsOf, createFakeDb, renderSql } from '../fixtures/fakeDb';

vi.mock('server-only', () => ({}));

describe('DrizzleInvestorFlowsUniverseRepository', () => {
    it('loadUniverse returns a CUSIP → {id, symbol} map and distinct symbols', async () => {
        const { db } = createFakeDb([
            [
                {
                    id: 1,
                    cusip: '037833100',
                    symbol: 'AAPL',
                    loadedAt: '2026-10-15 11:00:00.5+00',
                },
                {
                    id: 2,
                    cusip: '084670702',
                    symbol: 'BRK.B',
                    loadedAt: '2026-10-15 11:00:00.5+00',
                },
                {
                    id: 3,
                    cusip: '084670108',
                    symbol: 'BRK.B',
                    loadedAt: '2026-10-15 11:00:00.5+00',
                },
            ],
        ]);
        const universe = await new DrizzleInvestorFlowsUniverseRepository(
            db
        ).loadUniverse();
        expect([...universe.cusips]).toEqual([
            ['037833100', { id: 1, symbol: 'AAPL' }],
            ['084670702', { id: 2, symbol: 'BRK.B' }],
            ['084670108', { id: 3, symbol: 'BRK.B' }],
        ]);
        expect(universe.symbols).toEqual(['AAPL', 'BRK.B']);
        // the snapshot time is read from the DB clock in the same statement, never from the app clock
        expect(universe.loadedAt).toBe('2026-10-15 11:00:00.5+00');
    });

    it('loadUniverse of an empty map still stamps with the DB clock (a second now() query), not the app clock', async () => {
        const { db, ops } = createFakeDb([
            [],
            [{ now: '2026-10-15 11:00:00+00' }],
        ]);
        const universe = await new DrizzleInvestorFlowsUniverseRepository(
            db
        ).loadUniverse();
        expect(universe.cusips.size).toBe(0);
        expect(universe.loadedAt).toBe('2026-10-15 11:00:00+00');
        expect(ops.map(op => op.kind)).toEqual(['select', 'execute']);
    });

    it('countMapped / getState read from the DB, setStateIfAbsent never overwrites (ON CONFLICT DO NOTHING)', async () => {
        const { db, ops } = createFakeDb([[{ n: 1234 }], [{ value: 'v' }], []]);
        const repo = new DrizzleInvestorFlowsUniverseRepository(db);
        expect(await repo.countMapped()).toBe(1234);
        expect(await repo.getState('k')).toBe('v');
        await repo.setStateIfAbsent('k', 'new');
        expect(ops[2]?.kind).toBe('insert');
        expect(callsOf(ops[2] as never, 'onConflictDoNothing')).toHaveLength(1);
        expect(callsOf(ops[2] as never, 'onConflictDoUpdate')).toHaveLength(0);
    });

    it('lists re-check candidates fmp-sourced, never-checked first, then oldest checked', async () => {
        const { db, ops } = createFakeDb([
            [{ id: 1, cusip: '037833100', symbol: 'AAPL' }],
        ]);
        const rows = await new DrizzleInvestorFlowsUniverseRepository(
            db
        ).listRecheckCandidates(100);
        expect(rows).toEqual([{ id: 1, cusip: '037833100', symbol: 'AAPL' }]);
        const [[where]] = callsOf(ops[0] as never, 'where') as [[never]];
        expect(renderSql(where).params).toEqual(['fmp']);
        const [orderBy] = callsOf(ops[0] as never, 'orderBy') as [unknown[]];
        expect(renderSql(orderBy[0] as never).text).toBe(
            '"cusip_symbol_map"."checked_at" ASC NULLS FIRST'
        );
        expect(callsOf(ops[0] as never, 'limit')).toEqual([[100]]);
    });

    it('markChecked stamps checked_at for the given ids only (nothing for an empty list)', async () => {
        const { db, ops } = createFakeDb();
        const repo = new DrizzleInvestorFlowsUniverseRepository(db);
        await repo.markChecked([]);
        expect(ops).toEqual([]);
        await repo.markChecked([3, 4]);
        expect(ops[0]?.kind).toBe('update');
    });

    it('findExistingCusips returns the subset already in the map', async () => {
        const { db } = createFakeDb([[{ cusip: '037833100' }]]);
        const found = await new DrizzleInvestorFlowsUniverseRepository(
            db
        ).findExistingCusips(['037833100', '999999999']);
        expect([...found]).toEqual(['037833100']);
    });

    it('upserts the map in chunks and only rewrites rows whose symbol or source changed', async () => {
        const rows = Array.from({ length: 501 }, (_, i) => ({
            cusip: String(i).padStart(9, '0'),
            symbol: `S${i}`,
            source: 'fmp' as const,
        }));
        const { db, ops } = createFakeDb();
        await new DrizzleInvestorFlowsUniverseRepository(db).upsertCusipMap(
            rows
        );
        // one lookup of the existing mappings, then two insert chunks (no ticker lookup: nothing is contested)
        expect(ops.map(op => op.kind)).toEqual(['select', 'insert', 'insert']);
        expect(ops[1]?.target).toBe(cusipSymbolMap);
        const [[config]] = callsOf(ops[1] as never, 'onConflictDoUpdate') as [
            [{ setWhere: never }],
        ];
        const { text } = renderSql(config.setWhere);
        expect(text).toBe(
            '"cusip_symbol_map"."symbol" IS DISTINCT FROM excluded.symbol OR "cusip_symbol_map"."source" IS DISTINCT FROM excluded.source'
        );
    });

    describe('upsertCusipMap with a CUSIP claimed by more than one symbol', () => {
        const SHARED = '084670702';
        const valuesOf = (op: unknown): unknown =>
            (callsOf(op as never, 'values') as [[unknown]])[0]?.[0];

        it('writes the CUSIP once (smallest symbol) when two input rows share it', async () => {
            const { db, ops } = createFakeDb();
            const result = await new DrizzleInvestorFlowsUniverseRepository(
                db
            ).upsertCusipMap([
                { cusip: SHARED, symbol: 'BRKB', source: 'fmp' },
                { cusip: SHARED, symbol: 'BRK-B', source: 'fmp' },
            ]);
            expect(valuesOf(ops[1])).toEqual([
                { cusip: SHARED, symbol: 'BRK-B', source: 'fmp' },
            ]);
            expect(result.conflicts).toEqual([
                { cusip: SHARED, kept: 'BRK-B', dropped: ['BRKB'] },
            ]);
        });

        it('keeps the mapped symbol while it is still a live listing (nothing written for the newcomer)', async () => {
            const { db, ops } = createFakeDb([
                [{ cusip: SHARED, symbol: 'BRK-B' }],
                [{ symbol: 'BRK-B' }],
            ]);
            const result = await new DrizzleInvestorFlowsUniverseRepository(
                db
            ).upsertCusipMap([
                { cusip: SHARED, symbol: 'BRKB', source: 'fmp' },
            ]);
            expect(ops.map(op => op.kind)).toEqual(['select', 'select']);
            expect(result).toEqual({
                written: [],
                conflicts: [
                    { cusip: SHARED, kept: 'BRK-B', dropped: ['BRKB'] },
                ],
            });
        });

        it('lets the newcomer overwrite a mapped symbol that is no longer listed (ticker change)', async () => {
            const { db, ops } = createFakeDb([
                [{ cusip: '30303M102', symbol: 'FB' }],
                [],
            ]);
            const result = await new DrizzleInvestorFlowsUniverseRepository(
                db
            ).upsertCusipMap([
                { cusip: '30303M102', symbol: 'META', source: 'fmp' },
            ]);
            expect(valuesOf(ops[2])).toEqual([
                { cusip: '30303M102', symbol: 'META', source: 'fmp' },
            ]);
            expect(result.conflicts).toEqual([]);
        });

        it('asks the ticker DB only about contested mapped symbols, with the live-listing filter', async () => {
            const { db, ops } = createFakeDb([
                [{ cusip: '30303M102', symbol: 'FB' }],
                [],
            ]);
            await new DrizzleInvestorFlowsUniverseRepository(db).upsertCusipMap(
                [{ cusip: '30303M102', symbol: 'META', source: 'fmp' }]
            );
            const [[where]] = callsOf(ops[1] as never, 'where') as [[never]];
            const { text, params } = renderSql(where);
            expect(text).toBe(
                '("korean_tickers"."symbol" in ($1) and "korean_tickers"."delisted_at" is null and "korean_tickers"."exchange" in ($2, $3, $4))'
            );
            expect(params).toEqual(['FB', ...INVESTOR_FLOWS_US_EXCHANGES]);
        });

        it('does nothing for an empty input', async () => {
            const { db, ops } = createFakeDb();
            expect(
                await new DrizzleInvestorFlowsUniverseRepository(
                    db
                ).upsertCusipMap([])
            ).toEqual({ written: [], conflicts: [] });
            expect(ops).toEqual([]);
        });
    });

    it('lists unmapped candidates by symbol order after the cursor, excluding mapped symbols', async () => {
        const { db, ops } = createFakeDb([
            [{ symbol: 'AAA' }, { symbol: 'AAB' }],
        ]);
        const symbols = await new DrizzleInvestorFlowsUniverseRepository(
            db
        ).listUnmappedUsSymbols('AA', 500);
        expect(symbols).toEqual(['AAA', 'AAB']);
        const [[where]] = callsOf(ops[0] as never, 'where') as [[never]];
        const { text, params } = renderSql(where);
        expect(text).toBe(
            '("korean_tickers"."symbol" > $1 and "korean_tickers"."delisted_at" is null and "korean_tickers"."exchange" in ($2, $3, $4) and "korean_tickers"."symbol" not like $5 and "korean_tickers"."symbol" not like $6 and NOT EXISTS ( SELECT 1 FROM cusip_symbol_map m WHERE m.symbol = "korean_tickers"."symbol" ))'
        );
        expect(params).toContain('AA');
        expect(params).toEqual(
            expect.arrayContaining(['NASDAQ', 'NYSE', 'AMEX', '%.KS', '%.KQ'])
        );
        expect(callsOf(ops[0] as never, 'limit')).toEqual([[500]]);
    });
});

describe('DrizzleInvestorFlowsShortRepository', () => {
    it('reports dropped duplicate keys through the injected logger', async () => {
        const { db } = createFakeDb();
        const log = vi.fn();
        const row = {
            symbol: 'AAPL',
            tradeDate: '2026-10-14',
            shortVolume: 5,
            totalVolume: 10,
        };
        await new DrizzleInvestorFlowsShortRepository(
            db,
            log
        ).upsertShortVolume([row, { ...row, shortVolume: 6 }]);
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining(
                'finra_short_volume: dropped 1 duplicate-key row(s)'
            ),
            ['AAPL|2026-10-14']
        );
    });

    it('upserts short volume with a change guard', async () => {
        const { db, ops } = createFakeDb();
        await new DrizzleInvestorFlowsShortRepository(db).upsertShortVolume([
            {
                symbol: 'AAPL',
                tradeDate: '2026-10-14',
                shortVolume: 5,
                totalVolume: 10,
            },
        ]);
        expect(ops[0]?.target).toBe(finraShortVolume);
        const [[config]] = callsOf(ops[0] as never, 'onConflictDoUpdate') as [
            [{ setWhere: never }],
        ];
        expect(renderSql(config.setWhere).text).toBe(
            '"finra_short_volume"."short_volume" IS DISTINCT FROM excluded.short_volume OR "finra_short_volume"."total_volume" IS DISTINCT FROM excluded.total_volume'
        );
    });

    it('writes days_to_cover as a numeric string and null as null', async () => {
        const { db, ops } = createFakeDb();
        await new DrizzleInvestorFlowsShortRepository(db).upsertShortInterest([
            {
                symbol: 'AAPL',
                settlementDate: '2026-09-30',
                shortQty: 1,
                prevShortQty: 2,
                avgDailyVolume: 3,
                daysToCover: 3.03,
            },
            {
                symbol: 'MSFT',
                settlementDate: '2026-09-30',
                shortQty: 1,
                prevShortQty: null,
                avgDailyVolume: null,
                daysToCover: null,
            },
        ]);
        expect(ops[0]?.target).toBe(finraShortInterest);
        const [[values]] = callsOf(ops[0] as never, 'values') as [
            [{ daysToCover: string | null }[]],
        ];
        expect(values.map(v => v.daysToCover)).toEqual(['3.03', null]);
    });

    it('reads short interest back with days_to_cover as a number', async () => {
        const { db } = createFakeDb([
            [
                {
                    symbol: 'AAPL',
                    settlementDate: '2026-09-30',
                    shortQty: 9,
                    prevShortQty: 8,
                    avgDailyVolume: 7,
                    daysToCover: '3.03',
                },
            ],
        ]);
        const rows = await new DrizzleInvestorFlowsShortRepository(
            db
        ).findShortInterest('AAPL', 12);
        expect(rows).toEqual([
            {
                settlementDate: '2026-09-30',
                shortQty: 9,
                avgDailyVolume: 7,
                daysToCover: 3.03,
            },
        ]);
    });

    it('collects the stored settlement dates into a set', async () => {
        const { db } = createFakeDb([
            [
                { settlementDate: '2026-09-15' },
                { settlementDate: '2026-09-30' },
            ],
        ]);
        const dates = await new DrizzleInvestorFlowsShortRepository(
            db
        ).listShortInterestSettlementDates('2026-01-01');
        expect([...dates]).toEqual(['2026-09-15', '2026-09-30']);
    });
});

describe('DrizzleInvestorFlowsShortRepository.listShortVolumeTradeDates', () => {
    it('collects the stored trade dates on or after `since` into a set', async () => {
        const { db, ops } = createFakeDb([
            [{ tradeDate: '2026-10-14' }, { tradeDate: '2026-10-15' }],
        ]);
        const dates = await new DrizzleInvestorFlowsShortRepository(
            db
        ).listShortVolumeTradeDates('2026-07-17');
        expect([...dates]).toEqual(['2026-10-14', '2026-10-15']);
        expect(callsOf(ops[0] as never, 'from')).toEqual([[finraShortVolume]]);
        const [[where]] = callsOf(ops[0] as never, 'where') as [[never]];
        const { text, params } = renderSql(where);
        expect(text).toBe('"finra_short_volume"."trade_date" >= $1');
        expect(params).toEqual(['2026-07-17']);
    });
});

describe('DrizzleInvestorFlowsSnapshotRepository', () => {
    it('falls back to the cik when a filer name is unknown', async () => {
        const { db } = createFakeDb([
            [
                {
                    cik: 1,
                    filerName: null,
                    shares: 5,
                    valueK: 50,
                    prevShares: null,
                },
            ],
        ]);
        const [holder] = await new DrizzleInvestorFlowsSnapshotRepository(
            db
        ).findTopHolders('037833100', '2026-09-30', 25);
        expect(holder).toEqual({
            cik: '0000000001',
            filerName: '0000000001',
            shares: 5,
            valueUsd: 50_000, // value_k × 1000
            prevShares: null,
        });
    });

    it('exited holders: only an in-progress quarter (requireFiled) builds the "already filed" subquery', async () => {
        const selects = async (requireFiled: boolean) => {
            const { db, ops } = createFakeDb([[]]);
            await new DrizzleInvestorFlowsSnapshotRepository(
                db
            ).findExitedHolders('037833100', '2026-09-30', 5, requireFiled);
            return ops.filter(op => op.kind === 'select').length;
        };
        expect(await selects(false)).toBe(1);
        expect(await selects(true)).toBe(2);
    });

    it('limits the top-holder query and orders by shares descending', async () => {
        const { db, ops } = createFakeDb([[]]);
        await new DrizzleInvestorFlowsSnapshotRepository(db).findTopHolders(
            '037833100',
            '2026-09-30',
            7
        );
        expect(callsOf(ops[0] as never, 'limit')).toEqual([[7]]);
        expect(callsOf(ops[0] as never, 'orderBy')).toHaveLength(1);
    });

    it('reads 13F option aggregates newest first with the limit, passing the rows through', async () => {
        const row = {
            period: '2026-06-30',
            putHolders: 640,
            putShares: 280_000_000,
            putValueUsd: 58_800_000_000,
            callHolders: 700,
            callShares: 190_000_000,
            callValueUsd: 39_900_000_000,
        };
        const { db, ops } = createFakeDb([[row]]);
        expect(
            await new DrizzleInvestorFlowsSnapshotRepository(
                db
            ).findOptionAggregates('037833100', 8)
        ).toEqual([row]);
        expect(callsOf(ops[0] as never, 'from')).toEqual([
            [sec13fOptionAggregates],
        ]);
        expect(callsOf(ops[0] as never, 'limit')).toEqual([[8]]);
        expect(callsOf(ops[0] as never, 'orderBy')).toHaveLength(1);
    });

    describe('named-holder lookup reads', () => {
        const whereOf = (op: unknown) => {
            const [[where]] = callsOf(op as never, 'where') as [[never]];
            return renderSql(where);
        };

        it('findFilersByNameTokens: no tokens reads nothing', async () => {
            const { db, ops } = createFakeDb([[{ cik: 1, name: 'X' }]]);
            expect(
                await new DrizzleInvestorFlowsSnapshotRepository(
                    db
                ).findFilersByNameTokens([], 50)
            ).toEqual([]);
            expect(ops).toHaveLength(0);
        });

        it('findFilersByNameTokens: ANDs one upper(name) LIKE per token, shortest names first, with the limit', async () => {
            const rows = [{ cik: 7, name: 'ACME FUND' }];
            const { db, ops } = createFakeDb([rows]);
            expect(
                await new DrizzleInvestorFlowsSnapshotRepository(
                    db
                ).findFilersByNameTokens(['ACME', 'FUND'], 50)
            ).toEqual(rows);
            const { text, params } = whereOf(ops[0]);
            expect(text).toBe(
                '(upper("sec_13f_filers"."name") LIKE $1 and upper("sec_13f_filers"."name") LIKE $2)'
            );
            expect(params).toEqual(['%ACME%', '%FUND%']);
            expect(callsOf(ops[0] as never, 'limit')).toEqual([[50]]);
            expect(callsOf(ops[0] as never, 'orderBy')).toHaveLength(1);
        });

        it('findFilersByNameTokens: LIKE wildcards and the escape character in a token are matched literally', async () => {
            const { db, ops } = createFakeDb([[]]);
            await new DrizzleInvestorFlowsSnapshotRepository(
                db
            ).findFilersByNameTokens(['A%B_C\\D'], 50);
            expect(whereOf(ops[0]).params).toEqual(['%A\\%B\\_C\\\\D%']);
        });

        it('findFilersByNameTokens: the AND token (from "&") stays out of the SQL filter, so "DODGE & COX" is found', async () => {
            const { db, ops } = createFakeDb([
                [{ cik: 9, name: 'DODGE & COX' }],
            ]);
            expect(
                await new DrizzleInvestorFlowsSnapshotRepository(
                    db
                ).findFilersByNameTokens(['DODGE', 'AND', 'COX'], 50)
            ).toEqual([{ cik: 9, name: 'DODGE & COX' }]);
            // `LIKE '%AND%'` would not match the raw name "DODGE & COX"
            expect(whereOf(ops[0]).params).toEqual(['%DODGE%', '%COX%']);
        });

        it('findFilersByNameTokens: a query made only of AND reads nothing', async () => {
            const { db, ops } = createFakeDb([[]]);
            expect(
                await new DrizzleInvestorFlowsSnapshotRepository(
                    db
                ).findFilersByNameTokens(['AND'], 50)
            ).toEqual([]);
            expect(ops).toHaveLength(0);
        });

        it('findHolderPositions: no ciks reads nothing', async () => {
            const { db, ops } = createFakeDb([[]]);
            expect(
                await new DrizzleInvestorFlowsSnapshotRepository(
                    db
                ).findHolderPositions('037833100', '2026-09-30', [])
            ).toEqual([]);
            expect(ops).toHaveLength(0);
        });

        it('findHolderPositions: restricts to the filers and the period, largest first, value x1000, name falls back to the cik', async () => {
            const { db, ops } = createFakeDb([
                [
                    {
                        cik: 1,
                        filerName: 'Big LLC',
                        shares: 9,
                        valueK: 90,
                        prevShares: 8,
                    },
                    {
                        cik: 2,
                        filerName: null,
                        shares: 5,
                        valueK: 50,
                        prevShares: null,
                    },
                ],
            ]);
            const rows = await new DrizzleInvestorFlowsSnapshotRepository(
                db
            ).findHolderPositions('037833100', '2026-09-30', [1, 2]);
            expect(rows).toEqual([
                {
                    cik: 1,
                    filerName: 'Big LLC',
                    shares: 9,
                    valueUsd: 90_000,
                    prevShares: 8,
                },
                {
                    cik: 2,
                    filerName: '0000000002',
                    shares: 5,
                    valueUsd: 50_000,
                    prevShares: null,
                },
            ]);
            const { text, params } = whereOf(ops[0]);
            expect(text).toBe(
                '("sec_13f_positions"."cusip_id" = (SELECT id FROM cusip_symbol_map WHERE cusip = $1) and "sec_13f_positions"."period" = $2 and "sec_13f_positions"."cik" in ($3, $4))'
            );
            expect(params).toEqual(['037833100', '2026-09-30', 1, 2]);
            expect(callsOf(ops[0] as never, 'orderBy')).toHaveLength(1);
            // no LIMIT: the caller already bounded the filers (at most 5)
            expect(callsOf(ops[0] as never, 'limit')).toEqual([]);
        });

        it('findFilerFilings: no ciks reads nothing; otherwise filters on the filers and the period and passes rows through', async () => {
            const empty = createFakeDb([[]]);
            expect(
                await new DrizzleInvestorFlowsSnapshotRepository(
                    empty.db
                ).findFilerFilings('037833100', [], '2026-09-30')
            ).toEqual([]);
            expect(empty.ops).toHaveLength(0);

            const rows = [{ cik: 1, processed: true, couldListCusip: false }];
            const { db, ops } = createFakeDb([rows]);
            expect(
                await new DrizzleInvestorFlowsSnapshotRepository(
                    db
                ).findFilerFilings('037833100', [1], '2026-09-30')
            ).toEqual(rows);
            const { text, params } = whereOf(ops[0]);
            expect(text).toBe(
                '("sec_13f_filings"."cik" in ($1) and "sec_13f_filings"."period" = $2)'
            );
            expect(params).toEqual([1, '2026-09-30']);
        });

        it('countHoldersAbove: counts holders with strictly more shares in the period; no row is 0', async () => {
            const { db, ops } = createFakeDb([[{ count: 4 }], []]);
            const repo = new DrizzleInvestorFlowsSnapshotRepository(db);
            expect(
                await repo.countHoldersAbove('037833100', '2026-09-30', 1_000)
            ).toBe(4);
            const { text, params } = whereOf(ops[0]);
            expect(text).toBe(
                '("sec_13f_positions"."cusip_id" = (SELECT id FROM cusip_symbol_map WHERE cusip = $1) and "sec_13f_positions"."period" = $2 and "sec_13f_positions"."shares" > $3)'
            );
            expect(params).toEqual(['037833100', '2026-09-30', 1_000]);
            expect(
                await repo.countHoldersAbove('037833100', '2026-09-30', 1_000)
            ).toBe(0);
        });
    });

    it('returns exited holders with zero shares and their prior quarter shares', async () => {
        const { db } = createFakeDb([
            [{ cik: 9, filerName: 'Gone LLC', prevShares: 777 }],
        ]);
        const [exited] = await new DrizzleInvestorFlowsSnapshotRepository(
            db
        ).findExitedHolders('037833100', '2026-09-30', 5, false);
        expect(exited).toEqual({
            cik: '0000000009',
            filerName: 'Gone LLC',
            shares: 0,
            valueUsd: 0,
            prevShares: 777,
        });
    });
});

describe('DrizzleInvestorFlowsShortRepository.hasAnyRow', () => {
    it('is true as soon as the daily-volume table has a row, without touching the interest table', async () => {
        const { db, ops } = createFakeDb([[{ symbol: 'AAPL' }]]);
        expect(
            await new DrizzleInvestorFlowsShortRepository(db).hasAnyRow()
        ).toBe(true);
        expect(ops).toHaveLength(1);
        expect(callsOf(ops[0] as never, 'from')).toEqual([[finraShortVolume]]);
        expect(callsOf(ops[0] as never, 'limit')).toEqual([[1]]);
    });

    it('falls back to the interest table when the volume table is empty', async () => {
        const { db, ops } = createFakeDb([[], [{ symbol: 'AAPL' }]]);
        expect(
            await new DrizzleInvestorFlowsShortRepository(db).hasAnyRow()
        ).toBe(true);
        expect(ops).toHaveLength(2);
        expect(callsOf(ops[1] as never, 'from')).toEqual([
            [finraShortInterest],
        ]);
        expect(callsOf(ops[1] as never, 'limit')).toEqual([[1]]);
    });

    it('is false only when both tables are empty', async () => {
        const { db, ops } = createFakeDb([[], []]);
        expect(
            await new DrizzleInvestorFlowsShortRepository(db).hasAnyRow()
        ).toBe(false);
        expect(ops).toHaveLength(2);
    });
});
