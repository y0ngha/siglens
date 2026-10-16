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
        expect(renderSql(orderBy[0] as never).text).toContain(
            'ASC NULLS FIRST'
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
        expect(ops).toHaveLength(2);
        expect(ops[0]?.target).toBe(cusipSymbolMap);
        const [[config]] = callsOf(ops[0] as never, 'onConflictDoUpdate') as [
            [{ setWhere: never }],
        ];
        const { text } = renderSql(config.setWhere);
        expect(text).toContain('IS DISTINCT FROM excluded.symbol');
        expect(text).toContain('IS DISTINCT FROM excluded.source');
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
        expect(text).toContain('NOT EXISTS');
        expect(text).toContain('cusip_symbol_map');
        expect(params).toContain('AA');
        expect(params).toEqual(
            expect.arrayContaining(['NASDAQ', 'NYSE', 'AMEX', '%.KS', '%.KQ'])
        );
        expect(callsOf(ops[0] as never, 'limit')).toEqual([[500]]);
    });
});

describe('DrizzleInvestorFlowsShortRepository', () => {
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
        expect(renderSql(config.setWhere).text).toContain(
            'IS DISTINCT FROM excluded.short_volume'
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
