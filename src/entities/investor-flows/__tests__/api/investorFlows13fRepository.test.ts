import { describe, expect, it, vi } from 'vitest';
import {
    sec13fDirtyAggregates,
    sec13fFilers,
    sec13fFilings,
    sec13fOptionPositions,
    sec13fPositions,
} from '@/shared/db/schema';
import type { ApplyFilingInput } from '../../api/apply13fFiling';
import { Drizzle13fRepository } from '../../api/investorFlows13fRepository';
import { callsOf, createFakeDb, renderSql } from '../fixtures/fakeDb';

vi.mock('server-only', () => ({}));

const ABBOTT = '002824100';
const MSFT = '594918104';

const baseInput: ApplyFilingInput = {
    accession: '0002085853-26-001185',
    cik: '0002148692',
    filingDate: '2026-10-14',
    submissionType: '13F-HR',
    amendmentType: null,
    period: '2026-09-30',
    filerName: '15 Wealth Advisors LLC',
    mode: 'replace',
    rows: [
        { cusip: ABBOTT, shares: 19357, valueUsd: 1912972 },
        { cusip: MSFT, shares: 6800, valueUsd: 3487841 },
    ],
    optionRows: [],
    cusipIds: new Map([
        [ABBOTT, 11],
        [MSFT, 22],
    ]),
    firstForPeriod: false,
    universeStamp: '2026-10-15 11:00:00+00',
};

const targets = (ops: { target: unknown }[]) => ops.map(op => op.target);

describe('Drizzle13fRepository.applyFiling', () => {
    describe('replace mode', () => {
        it('copies the removed positions into the dirty queue (SQL side), deletes them, inserts the new rows, then dirty for the written ones — one transaction', async () => {
            const { db, ops } = createFakeDb([
                [], // execute: dirty <- positions
                [], // delete
                [], // execute: dirty <- option positions
                [], // delete option positions
                [{ cusipId: 11 }, { cusipId: 22 }], // insert positions returning
                [], // dirty insert
            ]);
            const touched = await new Drizzle13fRepository(db).applyFiling(
                baseInput
            );

            expect(ops.map(op => op.kind)).toEqual([
                'execute',
                'delete',
                'execute',
                'delete',
                'insert',
                'insert',
                'insert',
                'insert',
            ]);
            expect([1, 3, 4, 5, 6, 7].map(i => ops[i]?.target)).toEqual([
                sec13fPositions,
                sec13fOptionPositions,
                sec13fPositions,
                sec13fDirtyAggregates,
                sec13fFilers,
                sec13fFilings,
            ]);
            const copied = renderSql(ops[0]?.target as never);
            expect(copied.text).toBe(
                ' INSERT INTO sec_13f_dirty_aggregates (period, cusip_id) SELECT period, cusip_id FROM sec_13f_positions WHERE cik = $1 AND period = $2::date ON CONFLICT DO NOTHING'
            );
            expect(copied.params).toEqual([2148692, '2026-09-30']);
            expect(touched.sort()).toEqual([ABBOTT, MSFT]);
        });

        it('inserts compact rows: numeric cik, cusip id, thousands value, paired with the right values', async () => {
            const { db, ops } = createFakeDb([[], [], [{ cusipId: 11 }]]);
            await new Drizzle13fRepository(db).applyFiling(baseInput);
            const insert = ops.filter(
                op => op.target === sec13fPositions && op.kind === 'insert'
            )[0];
            const [[values]] = callsOf(insert as never, 'values') as [
                [unknown],
            ];
            expect(values).toEqual([
                {
                    shares: 19357,
                    cik: 2148692,
                    cusipId: 11,
                    period: '2026-09-30',
                    valueK: 1913,
                },
                {
                    shares: 6800,
                    cik: 2148692,
                    cusipId: 22,
                    period: '2026-09-30',
                    valueK: 3488,
                },
            ]);
        });

        it('marks dirty with the period and the cusip ids that were written', async () => {
            const { db, ops } = createFakeDb([
                [],
                [],
                [],
                [],
                [{ cusipId: 22 }],
            ]);
            await new Drizzle13fRepository(db).applyFiling(baseInput);
            const dirty = ops.find(op => op.target === sec13fDirtyAggregates);
            const [[values]] = callsOf(dirty as never, 'values') as [[unknown]];
            expect(values).toEqual([{ period: '2026-09-30', cusipId: 22 }]);
        });
    });

    describe('option rows', () => {
        const withOptions: ApplyFilingInput = {
            ...baseInput,
            mode: 'merge',
            rows: [],
            optionRows: [
                {
                    cusip: MSFT,
                    putCall: 'put',
                    shares: 6795,
                    valueUsd: 3485841,
                },
                { cusip: ABBOTT, putCall: 'call', shares: 10, valueUsd: 999 },
                // a CUSIP outside the universe map is not stored
                { cusip: 'ZZZZZZZZ9', putCall: 'call', shares: 1, valueUsd: 1 },
            ],
        };

        it('upserts universe option rows with cik, cusip, period and put/call paired to their values', async () => {
            const { db, ops } = createFakeDb([[{ cusip: MSFT }]]);
            await new Drizzle13fRepository(db).applyFiling(withOptions);
            const insert = ops.find(
                op =>
                    op.kind === 'insert' && op.target === sec13fOptionPositions
            );
            const [[values]] = callsOf(insert as never, 'values') as [
                [unknown],
            ];
            expect(values).toEqual([
                {
                    cik: 2148692,
                    cusip: MSFT,
                    period: '2026-09-30',
                    putCall: 'put',
                    shares: 6795,
                    valueUsd: 3485841,
                },
                {
                    cik: 2148692,
                    cusip: ABBOTT,
                    period: '2026-09-30',
                    putCall: 'call',
                    shares: 10,
                    valueUsd: 999,
                },
            ]);
        });

        it('marks the changed option CUSIPs dirty through their universe ids and reports them as written', async () => {
            const { db, ops } = createFakeDb([[{ cusip: MSFT }], []]);
            const touched = await new Drizzle13fRepository(db).applyFiling(
                withOptions
            );
            const dirty = ops.find(op => op.target === sec13fDirtyAggregates);
            const [[values]] = callsOf(dirty as never, 'values') as [[unknown]];
            expect(values).toEqual([{ period: '2026-09-30', cusipId: 22 }]);
            expect(touched).toEqual([MSFT]);
        });

        it('guards the option conflict update so unchanged rows are not rewritten', async () => {
            const { db, ops } = createFakeDb([[]]);
            await new Drizzle13fRepository(db).applyFiling(withOptions);
            const insert = ops.find(op => op.target === sec13fOptionPositions);
            const [[config]] = callsOf(
                insert as never,
                'onConflictDoUpdate'
            ) as [[{ setWhere: Parameters<typeof renderSql>[0] }]];
            const { text } = renderSql(config.setWhere);
            expect(text).toBe(
                '"sec_13f_option_positions"."shares" IS DISTINCT FROM excluded.shares OR "sec_13f_option_positions"."value_usd" IS DISTINCT FROM excluded.value_usd'
            );
        });

        it('a replace moves the removed option CUSIPs to the dirty queue through the CUSIP map, then deletes them', async () => {
            const { db, ops } = createFakeDb();
            await new Drizzle13fRepository(db).applyFiling({
                ...withOptions,
                mode: 'replace',
            });
            const copied = renderSql(ops[2]?.target as never);
            expect(copied.text).toBe(
                ' INSERT INTO sec_13f_dirty_aggregates (period, cusip_id) SELECT o.period, m.id FROM sec_13f_option_positions o JOIN cusip_symbol_map m ON m.cusip = o.cusip WHERE o.cik = $1 AND o.period = $2::date ON CONFLICT DO NOTHING'
            );
            expect(copied.params).toEqual([2148692, '2026-09-30']);
            expect(ops[3]).toMatchObject({
                kind: 'delete',
                target: sec13fOptionPositions,
            });
        });

        it('a skip writes no option rows', async () => {
            const { db, ops } = createFakeDb();
            await new Drizzle13fRepository(db).applyFiling({
                ...withOptions,
                mode: 'skip',
            });
            expect(ops.some(op => op.target === sec13fOptionPositions)).toBe(
                false
            );
        });

        it('re-applies a later amendment’s option rows after the replace', async () => {
            const { db, ops } = createFakeDb();
            await new Drizzle13fRepository(db).applyFiling({
                ...withOptions,
                mode: 'replace',
                optionRows: [],
                reapply: [
                    {
                        accession: '0001768130-26-000020',
                        rows: [],
                        optionRows: [
                            {
                                cusip: MSFT,
                                putCall: 'call',
                                shares: 3,
                                valueUsd: 30,
                            },
                        ],
                    },
                ],
            });
            const inserts = ops.filter(
                op =>
                    op.kind === 'insert' && op.target === sec13fOptionPositions
            );
            expect(inserts).toHaveLength(1);
            const [[values]] = callsOf(inserts[0] as never, 'values') as [
                [unknown],
            ];
            expect(values).toEqual([
                expect.objectContaining({
                    cusip: MSFT,
                    putCall: 'call',
                    shares: 3,
                }),
            ]);
        });
    });

    describe('merge mode', () => {
        it('never deletes existing positions and returns only the rows that changed', async () => {
            const { db, ops } = createFakeDb([[{ cusipId: 22 }]]);
            const touched = await new Drizzle13fRepository(db).applyFiling({
                ...baseInput,
                mode: 'merge',
            });
            expect(ops.map(op => op.kind)).not.toContain('delete');
            expect(touched).toEqual([MSFT]);
        });

        it('guards the conflict update so unchanged rows are not rewritten', async () => {
            const { db, ops } = createFakeDb([[]]);
            await new Drizzle13fRepository(db).applyFiling({
                ...baseInput,
                mode: 'merge',
            });
            const [[config]] = callsOf(
                ops[0] as never,
                'onConflictDoUpdate'
            ) as [[{ setWhere: Parameters<typeof renderSql>[0] }]];
            const { text } = renderSql(config.setWhere);
            expect(text).toBe(
                '"sec_13f_positions"."shares" IS DISTINCT FROM excluded.shares OR "sec_13f_positions"."value_k" IS DISTINCT FROM excluded.value_k'
            );
        });
    });

    describe('firstForPeriod', () => {
        it('also marks the filer’s prior-quarter CUSIPs dirty for the current period (exits are recomputed)', async () => {
            const { db, ops } = createFakeDb([[], [], []]);
            await new Drizzle13fRepository(db).applyFiling({
                ...baseInput,
                mode: 'merge',
                rows: [],
                firstForPeriod: true,
            });
            const executes = ops.filter(op => op.kind === 'execute');
            const { text, params } = renderSql(executes[0]?.target as never);
            expect(text).toBe(
                ' INSERT INTO sec_13f_dirty_aggregates (period, cusip_id) SELECT $1::date, cusip_id FROM sec_13f_positions WHERE cik = $2 AND period = $3::date ON CONFLICT DO NOTHING'
            );
            expect(params).toEqual(['2026-09-30', 2148692, '2026-06-30']);
        });

        it('also marks the filer’s NEXT-quarter CUSIPs dirty when it already filed the next quarter (the next quarter’s panel membership changed)', async () => {
            const { db, ops } = createFakeDb([[], [], []]);
            await new Drizzle13fRepository(db).applyFiling({
                ...baseInput,
                mode: 'merge',
                rows: [],
                firstForPeriod: true,
            });
            const executes = ops.filter(op => op.kind === 'execute');
            expect(executes).toHaveLength(2);
            const { text, params } = renderSql(executes[1]?.target as never);
            expect(text).toBe(
                ' INSERT INTO sec_13f_dirty_aggregates (period, cusip_id) SELECT $1::date, cusip_id FROM sec_13f_positions WHERE cik = $2 AND period = $3::date ON CONFLICT DO NOTHING'
            );
            expect(params).toEqual(['2026-12-31', 2148692, '2026-12-31']);
        });

        it('does nothing extra for a later filing of the same filer and period', async () => {
            const { db, ops } = createFakeDb([[]]);
            await new Drizzle13fRepository(db).applyFiling({
                ...baseInput,
                mode: 'merge',
                firstForPeriod: false,
            });
            expect(ops.filter(op => op.kind === 'execute')).toEqual([]);
        });
    });

    describe('reapply (later NEW HOLDINGS after a RESTATEMENT replace)', () => {
        it('re-inserts the re-applied rows after the replace insert, in the same transaction, marking them dirty', async () => {
            const { db, ops } = createFakeDb([
                [], // dirty <- removed positions
                [], // delete
                [], // dirty <- removed option positions
                [], // delete option positions
                [{ cusipId: 11 }], // restatement rows
                [], // dirty
                [{ cusipId: 22 }], // reapplied rows
                [], // dirty
            ]);
            const touched = await new Drizzle13fRepository(db).applyFiling({
                ...baseInput,
                rows: [{ cusip: ABBOTT, shares: 1, valueUsd: 1_000 }],
                reapply: [
                    {
                        accession: '0001768130-26-000020',
                        rows: [{ cusip: MSFT, shares: 9, valueUsd: 9_000 }],
                        optionRows: [],
                    },
                ],
            });
            const positionInserts = ops.filter(
                op => op.kind === 'insert' && op.target === sec13fPositions
            );
            expect(positionInserts).toHaveLength(2);
            const [[first]] = callsOf(
                positionInserts[0] as never,
                'values'
            ) as [[{ cusipId: number }[]]];
            const [[second]] = callsOf(
                positionInserts[1] as never,
                'values'
            ) as [[{ cusipId: number; shares: number }[]]];
            expect(first[0]?.cusipId).toBe(11);
            expect(second[0]).toMatchObject({ cusipId: 22, shares: 9 });
            // the delete precedes both inserts
            expect(ops.findIndex(op => op.kind === 'delete')).toBeLessThan(
                ops.indexOf(positionInserts[0] as never)
            );
            expect(touched.sort()).toEqual([ABBOTT, MSFT]);
        });

        it('does not touch the ledger row of a re-applied amendment (it is already processed)', async () => {
            const { db, ops } = createFakeDb();
            await new Drizzle13fRepository(db).applyFiling({
                ...baseInput,
                reapply: [
                    {
                        accession: '0001768130-26-000020',
                        rows: [],
                        optionRows: [],
                    },
                ],
            });
            const ledgerValues = ops
                .filter(op => op.target === sec13fFilings)
                .flatMap(op => callsOf(op, 'values'))
                .map(([v]) => (v as { accession: string }).accession);
            expect(ledgerValues).toEqual([baseInput.accession]);
        });
    });

    describe('skip mode', () => {
        it('touches no positions or dirty rows but still records the filing as processed', async () => {
            const { db, ops } = createFakeDb();
            const touched = await new Drizzle13fRepository(db).applyFiling({
                ...baseInput,
                mode: 'skip',
                rows: [],
            });
            expect(touched).toEqual([]);
            expect(targets(ops)).toEqual([sec13fFilers, sec13fFilings]);
        });
    });

    it('marks the accession processed with the numeric cik, period and amendment type', async () => {
        const { db, ops } = createFakeDb();
        await new Drizzle13fRepository(db).applyFiling({
            ...baseInput,
            mode: 'merge',
            rows: [],
            submissionType: '13F-HR/A',
            amendmentType: 'NEW HOLDINGS',
        });
        const ledger = ops.find(op => op.target === sec13fFilings);
        const [[values]] = callsOf(ledger as never, 'values') as [
            [Record<string, unknown>],
        ];
        expect(values).toMatchObject({
            accession: baseInput.accession,
            cik: 2148692,
            period: '2026-09-30',
            filingDate: '2026-10-14',
            submissionType: '13F-HR/A',
            amendmentType: 'NEW HOLDINGS',
            attempts: 0,
        });
        // both on the DB clock (`now()`), the same clock as cusip_symbol_map.created_at
        const processed = renderSql(values.processedAt as never);
        expect(processed.text).toBe('now()');
    });

    it('stamps the ledger row with the universe snapshot it was parsed against (insert and conflict path)', async () => {
        const { db, ops } = createFakeDb();
        await new Drizzle13fRepository(db).applyFiling({
            ...baseInput,
            mode: 'merge',
            rows: [],
            universeStamp: '2026-10-15 11:00:00.123456+00',
        });
        const ledger = ops.find(op => op.target === sec13fFilings);
        const [[values]] = callsOf(ledger as never, 'values') as [
            [Record<string, unknown>],
        ];
        const stamp = renderSql(values.universeStamp as never);
        expect(stamp.text).toBe('$1::timestamptz');
        expect(stamp.params).toEqual(['2026-10-15 11:00:00.123456+00']);
        const [[conflict]] = callsOf(ledger as never, 'onConflictDoUpdate') as [
            [{ set: Record<string, unknown> }],
        ];
        expect(renderSql(conflict.set.universeStamp as never).text).toBe(
            'excluded.universe_stamp'
        );
    });

    it('splits large row sets into chunks (one insert per chunk)', async () => {
        const ids = new Map<string, number>();
        const rows = Array.from({ length: 1201 }, (_, i) => {
            const cusip = String(i).padStart(9, '0');
            ids.set(cusip, i + 1);
            return { cusip, shares: 1, valueUsd: 1 };
        });
        const { db, ops } = createFakeDb();
        await new Drizzle13fRepository(db).applyFiling({
            ...baseInput,
            mode: 'merge',
            rows,
            cusipIds: ids,
        });
        expect(ops.filter(op => op.target === sec13fPositions)).toHaveLength(3); // 500 + 500 + 201
    });

    it('drops rows whose CUSIP has no map id instead of failing', async () => {
        const { db, ops } = createFakeDb();
        await new Drizzle13fRepository(db).applyFiling({
            ...baseInput,
            mode: 'merge',
            rows: [{ cusip: 'NOTINMAP9', shares: 1, valueUsd: 1 }],
        });
        expect(ops.filter(op => op.target === sec13fPositions)).toEqual([]);
    });

    it('skips the filer upsert when the filer name is unknown', async () => {
        const { db, ops } = createFakeDb();
        await new Drizzle13fRepository(db).applyFiling({
            ...baseInput,
            filerName: null,
            mode: 'skip',
            rows: [],
        });
        expect(targets(ops)).toEqual([sec13fFilings]);
    });
});

describe('Drizzle13fRepository.recomputeAggregates', () => {
    it('complete mode runs the full upsert then the delete', async () => {
        const { db, ops } = createFakeDb();
        await new Drizzle13fRepository(db).recomputeAggregates(
            '2026-09-30',
            ['A', 'B'],
            'complete'
        );
        expect(ops.map(op => op.kind)).toEqual([
            'execute',
            'execute',
            'execute',
            'execute',
        ]);
        const upsert = renderSql(ops[0]?.target as never);
        expect(upsert.text).toBe(
            ' WITH m AS ( SELECT id, cusip, created_at FROM cusip_symbol_map WHERE cusip IN ($1, $2) ), pe AS ( SELECT min(universe_stamp) AS first_at FROM sec_13f_filings WHERE period = $3 AND processed_at IS NOT NULL ), j AS ( SELECT coalesce(c.cusip_id, p.cusip_id) AS cusip_id, c.shares AS cur_shares, c.value_k AS cur_value, p.shares AS prev_shares FROM ( SELECT cik, cusip_id, shares, value_k FROM sec_13f_positions WHERE period = $4 AND cusip_id IN (SELECT id FROM m) ) c FULL OUTER JOIN ( SELECT cik, cusip_id, shares FROM sec_13f_positions WHERE period = $5 AND cusip_id IN (SELECT id FROM m) ) p ON p.cik = c.cik AND p.cusip_id = c.cusip_id ) INSERT INTO sec_13f_aggregates AS a (cusip, period, holders, shares, value_usd, new_holders, increased, decreased, exited, net_share_change, computed_at) SELECT m.cusip, $6::date, (count(*) FILTER (WHERE j.cur_shares IS NOT NULL))::int, (coalesce(sum(j.cur_shares), 0))::bigint, (coalesce(sum(j.cur_value), 0) * 1000)::bigint, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares IS NOT NULL AND j.prev_shares IS NULL))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares > j.prev_shares))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares < j.prev_shares))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares IS NULL AND j.prev_shares IS NOT NULL))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (coalesce(sum(j.cur_shares), 0) - coalesce(sum(j.prev_shares), 0))::bigint END, now() FROM j JOIN m ON m.id = j.cusip_id GROUP BY m.id, m.cusip, m.created_at ON CONFLICT (cusip, period) DO UPDATE SET holders = excluded.holders, shares = excluded.shares, value_usd = excluded.value_usd, new_holders = excluded.new_holders, increased = excluded.increased, decreased = excluded.decreased, exited = excluded.exited, net_share_change = excluded.net_share_change, computed_at = now() WHERE (a.holders, a.shares, a.value_usd, a.new_holders, a.increased, a.decreased, a.exited, a.net_share_change) IS DISTINCT FROM (excluded.holders, excluded.shares, excluded.value_usd, excluded.new_holders, excluded.increased, excluded.decreased, excluded.exited, excluded.net_share_change)'
        );
        expect(upsert.params).toContain('2026-06-30'); // prior quarter
        expect(upsert.params).not.toContain('2026-08-14'); // no calendar cutoff: the per-CUSIP baseline comes from ingestion times
    });

    it('recomputes the option aggregates for the same chunk after the stock aggregates', async () => {
        const { db, ops } = createFakeDb();
        await new Drizzle13fRepository(db).recomputeAggregates(
            '2026-09-30',
            ['A', 'B'],
            'none'
        );
        const optionUpsert = renderSql(ops[2]?.target as never);
        const optionDelete = renderSql(ops[3]?.target as never);
        expect(optionUpsert.text).toBe(
            " INSERT INTO sec_13f_option_aggregates AS a (cusip, period, put_holders, put_shares, put_value_usd, call_holders, call_shares, call_value_usd, computed_at) SELECT o.cusip, $1::date, (count(*) FILTER (WHERE o.put_call = 'put'))::int, (coalesce(sum(o.shares) FILTER (WHERE o.put_call = 'put'), 0))::bigint, (coalesce(sum(o.value_usd) FILTER (WHERE o.put_call = 'put'), 0))::bigint, (count(*) FILTER (WHERE o.put_call = 'call'))::int, (coalesce(sum(o.shares) FILTER (WHERE o.put_call = 'call'), 0))::bigint, (coalesce(sum(o.value_usd) FILTER (WHERE o.put_call = 'call'), 0))::bigint, now() FROM sec_13f_option_positions o WHERE o.period = $2 AND o.cusip IN ($3, $4) GROUP BY o.cusip ON CONFLICT (cusip, period) DO UPDATE SET put_holders = excluded.put_holders, put_shares = excluded.put_shares, put_value_usd = excluded.put_value_usd, call_holders = excluded.call_holders, call_shares = excluded.call_shares, call_value_usd = excluded.call_value_usd, computed_at = now() WHERE (a.put_holders, a.put_shares, a.put_value_usd, a.call_holders, a.call_shares, a.call_value_usd) IS DISTINCT FROM (excluded.put_holders, excluded.put_shares, excluded.put_value_usd, excluded.call_holders, excluded.call_shares, excluded.call_value_usd)"
        );
        expect(optionUpsert.params).toEqual([
            '2026-09-30',
            '2026-09-30',
            'A',
            'B',
        ]);
        expect(optionDelete.text).toBe(
            ' DELETE FROM sec_13f_option_aggregates a WHERE a.period = $1 AND a.cusip IN ($2, $3) AND NOT EXISTS ( SELECT 1 FROM sec_13f_option_positions o WHERE o.cusip = a.cusip AND o.period = $4 )'
        );
    });

    it('panel mode adds the panel filer filters', async () => {
        const { db, ops } = createFakeDb();
        await new Drizzle13fRepository(db).recomputeAggregates(
            '2026-09-30',
            ['A'],
            'panel'
        );
        expect(renderSql(ops[0]?.target as never).text).toBe(
            ' WITH m AS ( SELECT id, cusip, created_at FROM cusip_symbol_map WHERE cusip IN ($1) ), pe AS ( SELECT min(universe_stamp) AS first_at FROM sec_13f_filings WHERE period = $2 AND processed_at IS NOT NULL ), j AS ( SELECT coalesce(c.cusip_id, p.cusip_id) AS cusip_id, c.shares AS cur_shares, c.value_k AS cur_value, p.shares AS prev_shares FROM ( SELECT cik, cusip_id, shares, value_k FROM sec_13f_positions WHERE period = $3 AND cusip_id IN (SELECT id FROM m) AND cik IN (SELECT cik FROM sec_13f_filings WHERE period = $4 AND processed_at IS NOT NULL) AND cik IN (SELECT cik FROM sec_13f_filings WHERE period = $5 AND processed_at IS NOT NULL) ) c FULL OUTER JOIN ( SELECT cik, cusip_id, shares FROM sec_13f_positions WHERE period = $6 AND cusip_id IN (SELECT id FROM m) AND cik IN (SELECT cik FROM sec_13f_filings WHERE period = $7 AND processed_at IS NOT NULL) AND cik IN (SELECT cik FROM sec_13f_filings WHERE period = $8 AND processed_at IS NOT NULL) ) p ON p.cik = c.cik AND p.cusip_id = c.cusip_id ) INSERT INTO sec_13f_aggregates AS a (cusip, period, holders, shares, value_usd, new_holders, increased, decreased, exited, net_share_change, computed_at) SELECT m.cusip, $9::date, (count(*) FILTER (WHERE j.cur_shares IS NOT NULL))::int, (coalesce(sum(j.cur_shares), 0))::bigint, (coalesce(sum(j.cur_value), 0) * 1000)::bigint, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares IS NOT NULL AND j.prev_shares IS NULL))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares > j.prev_shares))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares < j.prev_shares))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares IS NULL AND j.prev_shares IS NOT NULL))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (coalesce(sum(j.cur_shares), 0) - coalesce(sum(j.prev_shares), 0))::bigint END, now() FROM j JOIN m ON m.id = j.cusip_id GROUP BY m.id, m.cusip, m.created_at ON CONFLICT (cusip, period) DO UPDATE SET holders = excluded.holders, shares = excluded.shares, value_usd = excluded.value_usd, new_holders = excluded.new_holders, increased = excluded.increased, decreased = excluded.decreased, exited = excluded.exited, net_share_change = excluded.net_share_change, computed_at = now() WHERE (a.holders, a.shares, a.value_usd, a.new_holders, a.increased, a.decreased, a.exited, a.net_share_change) IS DISTINCT FROM (excluded.holders, excluded.shares, excluded.value_usd, excluded.new_holders, excluded.increased, excluded.decreased, excluded.exited, excluded.net_share_change)'
        );
    });

    it('none mode runs the baseline-less statements (no join, no prior period)', async () => {
        const { db, ops } = createFakeDb();
        await new Drizzle13fRepository(db).recomputeAggregates(
            '2026-03-31',
            ['A'],
            'none'
        );
        const upsert = renderSql(ops[0]?.target as never);
        expect(upsert.text).toBe(
            ' WITH m AS ( SELECT id, cusip FROM cusip_symbol_map WHERE cusip IN ($1) ) INSERT INTO sec_13f_aggregates AS a (cusip, period, holders, shares, value_usd, computed_at) SELECT m.cusip, $2::date, (count(*))::int, (coalesce(sum(p.shares), 0))::bigint, (coalesce(sum(p.value_k), 0) * 1000)::bigint, now() FROM sec_13f_positions p JOIN m ON m.id = p.cusip_id WHERE p.period = $3 GROUP BY m.cusip ON CONFLICT (cusip, period) DO UPDATE SET holders = excluded.holders, shares = excluded.shares, value_usd = excluded.value_usd, computed_at = now() WHERE (a.holders, a.shares, a.value_usd) IS DISTINCT FROM (excluded.holders, excluded.shares, excluded.value_usd)'
        );
        expect(upsert.params).not.toContain('2025-12-31');
    });

    it('does nothing for an empty cusip list', async () => {
        const { db, ops } = createFakeDb();
        await new Drizzle13fRepository(db).recomputeAggregates(
            '2026-09-30',
            [],
            'complete'
        );
        expect(ops).toEqual([]);
    });
});

describe('Drizzle13fRepository.markPeriodDirty', () => {
    it('queues every CUSIP that has positions in the period, in SQL (no ids pulled into memory)', async () => {
        const { db, ops } = createFakeDb([Object.assign([], { count: 8123 })]);
        const marked = await new Drizzle13fRepository(db).markPeriodDirty(
            '2026-06-30'
        );
        expect(marked).toBe(8123);
        const { text, params } = renderSql(ops[0]?.target as never);
        expect(text).toBe(
            ' INSERT INTO sec_13f_dirty_aggregates (period, cusip_id) SELECT DISTINCT $1::date, cusip_id FROM sec_13f_positions WHERE period = $2::date ON CONFLICT DO NOTHING'
        );
        expect(params).toEqual(['2026-06-30', '2026-06-30']);
    });
});

describe('Drizzle13fRepository dirty queue', () => {
    it('takeDirty returns null when nothing is dirty', async () => {
        const { db } = createFakeDb([[{ period: null }]]);
        expect(await new Drizzle13fRepository(db).takeDirty(500)).toBeNull();
    });

    it('takeDirty reads the oldest period then its entries joined with the map', async () => {
        const { db, ops } = createFakeDb([
            [{ period: '2026-06-30' }],
            [{ id: 5, cusip: ABBOTT, symbol: 'ABT' }],
        ]);
        const batch = await new Drizzle13fRepository(db).takeDirty(500);
        expect(batch).toEqual({
            period: '2026-06-30',
            entries: [{ id: 5, cusip: ABBOTT, symbol: 'ABT' }],
        });
        expect(callsOf(ops[1] as never, 'limit')).toEqual([[500]]);
    });

    it('takeDirty drops orphan dirty rows (no map entry) instead of looping forever', async () => {
        const { db, ops } = createFakeDb([
            [{ period: '2026-06-30' }],
            [],
            [],
            [{ period: null }],
        ]);
        expect(await new Drizzle13fRepository(db).takeDirty(500)).toBeNull();
        expect(
            ops.some(
                op =>
                    op.kind === 'delete' && op.target === sec13fDirtyAggregates
            )
        ).toBe(true);
    });

    it('clearDirty deletes exactly the given (period, ids) and does nothing for an empty list', async () => {
        const { db, ops } = createFakeDb();
        const repo = new Drizzle13fRepository(db);
        await repo.clearDirty('2026-06-30', []);
        expect(ops).toEqual([]);
        await repo.clearDirty('2026-06-30', [5, 6]);
        const [[where]] = callsOf(ops[0] as never, 'where') as [[never]];
        const { params } = renderSql(where);
        expect(params).toEqual(['2026-06-30', 5, 6]);
    });
});

describe('Drizzle13fRepository.recordFailure', () => {
    it('increments attempts on conflict and keeps processed_at untouched; stores the numeric cik', async () => {
        const { db, ops } = createFakeDb();
        await new Drizzle13fRepository(db).recordFailure(
            {
                accession: 'a',
                cik: '0000000042',
                filingDate: '2026-10-14',
                submissionType: '13F-HR',
            },
            'boom'
        );
        const [[values]] = callsOf(ops[0] as never, 'values') as [
            [{ cik: number }],
        ];
        expect(values.cik).toBe(42);
        const [[config]] = callsOf(ops[0] as never, 'onConflictDoUpdate') as [
            [{ set: Record<string, unknown> }],
        ];
        expect(Object.keys(config.set).sort()).toEqual([
            'attempts',
            'lastError',
        ]);
        expect(renderSql(config.set.attempts as never).text).toBe(
            '"sec_13f_filings"."attempts" + 1'
        );
    });
});

describe('Drizzle13fRepository reads', () => {
    it('findFilings queries in chunks of 1000, merges and renders the cik as 10 digits', async () => {
        const row = (accession: string) => ({
            accession,
            cik: 7,
            period: '2026-09-30',
            filingDate: '2026-10-14',
            submissionType: '13F-HR',
            amendmentType: null,
            attempts: 0,
            processedAt: new Date(0),
            lastError: null,
        });
        const accessions = Array.from({ length: 1500 }, (_, i) => `a${i}`);
        const { db, ops } = createFakeDb([[row('a1')], [row('a1200')]]);
        const found = await new Drizzle13fRepository(db).findFilings(
            accessions
        );
        expect(ops).toHaveLength(2);
        expect([...found.keys()].sort()).toEqual(['a1', 'a1200']);
        expect(found.get('a1')?.cik).toBe('0000000007');
    });

    it('countProcessedFilersForPeriod returns the distinct processed filer count, 0 when there is no row', async () => {
        expect(
            await new Drizzle13fRepository(
                createFakeDb([[{ n: 4321 }]]).db
            ).countProcessedFilersForPeriod('2026-06-30')
        ).toBe(4321);
        expect(
            await new Drizzle13fRepository(
                createFakeDb([[]]).db
            ).countProcessedFilersForPeriod('2026-06-30')
        ).toBe(0);
    });

    it('counts distinct ciks of applied filings in that period only', async () => {
        const { db, ops } = createFakeDb([[{ n: 1 }]]);
        await new Drizzle13fRepository(db).countProcessedFilersForPeriod(
            '2026-06-30'
        );
        const [[where]] = callsOf(ops[0] as never, 'where') as [[never]];
        const { text, params } = renderSql(where);
        expect(text).toBe(
            '("sec_13f_filings"."period" = $1 and "sec_13f_filings"."processed_at" is not null)'
        );
        expect(params).toEqual(['2026-06-30']);
    });
});

describe('Drizzle13fRepository prune (no RETURNING, driver row counts)', () => {
    const withCount = (count: number) => Object.assign([], { count });

    it('positions: deletes in ctid batches until a short batch, summing the driver counts', async () => {
        const { db, ops } = createFakeDb([
            withCount(50_000),
            withCount(50_000),
            withCount(1_234),
        ]);
        const result = await new Drizzle13fRepository(db).prunePositionsBefore(
            '2026-03-31',
            () => false
        );
        expect(result).toEqual({ deleted: 101_234, done: true });
        const { text, params } = renderSql(ops[0]?.target as never);
        expect(text).toBe(
            ' DELETE FROM sec_13f_positions WHERE ctid IN ( SELECT ctid FROM sec_13f_positions WHERE period < $1::date LIMIT $2 )'
        );
        expect(params).toEqual(['2026-03-31', 50_000]);
    });

    it('positions: stops between batches when told to and reports not done', async () => {
        const { db, ops } = createFakeDb([
            withCount(50_000),
            withCount(50_000),
        ]);
        let calls = 0;
        const result = await new Drizzle13fRepository(db).prunePositionsBefore(
            '2026-03-31',
            () => calls++ >= 1
        );
        expect(result).toEqual({ deleted: 50_000, done: false });
        expect(ops).toHaveLength(1);
    });

    it('option positions are pruned with the same floor once the stock positions are done', async () => {
        const { db, ops } = createFakeDb([withCount(10), withCount(7)]);
        const result = await new Drizzle13fRepository(db).prunePositionsBefore(
            '2026-03-31',
            () => false
        );
        expect(result).toEqual({ deleted: 17, done: true });
        const { text, params } = renderSql(ops[1]?.target as never);
        expect(text).toBe(
            ' DELETE FROM sec_13f_option_positions WHERE ctid IN ( SELECT ctid FROM sec_13f_option_positions WHERE period < $1::date LIMIT $2 )'
        );
        expect(params).toEqual(['2026-03-31', 50_000]);
    });

    it('aggregates and filings return the driver count', async () => {
        const { db, ops } = createFakeDb([
            withCount(3),
            withCount(2),
            withCount(4),
        ]);
        const repo = new Drizzle13fRepository(db);
        // stock aggregates + option aggregates
        expect(await repo.pruneAggregatesBefore('2023-09-30')).toBe(5);
        expect(renderSql(ops[1]?.target as never).text).toBe(
            'DELETE FROM sec_13f_option_aggregates WHERE period < $1::date'
        );
        expect(await repo.pruneFilingsBefore('2024-08-01')).toBe(4);
    });
});

describe('Drizzle13fRepository state and backlog', () => {
    it('getState/setState round-trip through the state table', async () => {
        const { db, ops } = createFakeDb([[{ value: '2026-03-31' }], []]);
        const repo = new Drizzle13fRepository(db);
        expect(await repo.getState('k')).toBe('2026-03-31');
        await repo.setState('k', 'v');
        const [[values]] = callsOf(ops[1] as never, 'values') as [[unknown]];
        expect(values).toEqual({ key: 'k', value: 'v' });
    });

    it('counts permanently failed accessions', async () => {
        expect(
            await new Drizzle13fRepository(
                createFakeDb([[{ n: 57 }]]).db
            ).countExhaustedFailures(3)
        ).toBe(57);
    });
});
