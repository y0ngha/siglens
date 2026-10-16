import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTarget } from '../../../../../db/scripts/lib/dbTarget';
import * as schema from '@/shared/db/schema';
import {
    INVESTOR_FLOWS_PRUNE_BATCH_SIZE,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../../lib/investorFlowsPolicy';
import { Drizzle13fRepository } from '../../api/investorFlows13fRepository';
import { DrizzleInvestorFlowsUniverseRepository } from '../../api/investorFlowsUniverseRepository';
import { run13fIngest } from '../../server/ingest13f';
import {
    FILING_INDEX_JSON,
    PRIMARY_DOC_ORIGINAL,
} from '../fixtures/investorFlowsSamples';

vi.mock('server-only', () => ({}));

/**
 * 집계·dirty·정리 SQL을 **진짜 Postgres**에서 검증한다(렌더 문자열 테스트로는 의미를 못 본다).
 *
 * 기본은 건너뛴다(`TEST_DATABASE_URL`이 없으면 — 모든 `*.db.test.ts`가 같은 변수를 쓴다, TESTING.md#TE-55).
 * 로컬 DB로 돌리려면(충돌 없게 전용 compose 프로젝트로):
 *   docker compose -p flows-test -f docker-compose.e2e.yml up -d --pull never postgres
 *   TEST_DATABASE_URL=postgres://siglens:siglens@localhost:5433/siglens_e2e yarn test db.test
 *   docker compose -p flows-test -f docker-compose.e2e.yml down -v
 *
 * 안전: 접속 대상이 로컬(터널 포트 제외)이 아니면 거부한다. 임시 스키마를 만들어 마이그레이션 `0048`·`0049` SQL을
 * 그대로 적용하고 끝나면 스키마를 통째로 지운다 — 기존 테이블·데이터는 건드리지 않는다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `investor_flows_test_${process.pid}`;
/** The investor-flows migrations, applied in journal order (0049 adds the option tables used below). */
const MIGRATIONS = [
    '0048_investor_flows_data.sql',
    '0049_investor_flows_expansion.sql',
].map(file => path.join(process.cwd(), 'drizzle', file));

const CUR = '2026-06-30'; // complete quarter
const PREV = '2026-03-31';
const C = '999999999';
/** A fixed snapshot stamp for tests that do not care about the baseline rule. */
const STAMP = '2026-01-01 00:00:00+00';

describe.skipIf(!URL)('investor flows SQL on a real Postgres', () => {
    let admin: postgres.Sql;
    let client: postgres.Sql;
    let repo: Drizzle13fRepository;
    let db: ReturnType<typeof drizzle<typeof schema>>;
    let cusipId: number;

    beforeAll(async () => {
        const target = describeTarget(URL as string);
        if (!target.isLocal || target.viaTunnel) {
            throw new Error(
                `refusing to run against a non-local database: ${target.host}`
            );
        }
        admin = postgres(URL as string, { max: 1 });
        await admin.unsafe(`CREATE SCHEMA "${SCHEMA}"`);
        client = postgres(URL as string, {
            max: 1,
            connection: { search_path: SCHEMA },
        });
        for (const migration of MIGRATIONS) {
            for (const statement of readFileSync(migration, 'utf8').split(
                '--> statement-breakpoint'
            )) {
                await client.unsafe(statement);
            }
        }
        db = drizzle(client, { schema });
        repo = new Drizzle13fRepository(db as never);
    });

    afterAll(async () => {
        await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
        await client?.end();
        await admin?.end();
    });

    /**
     * Clears every table and maps `C` through the REAL write path (`upsertCusipMap`), so `created_at` is `now()` exactly as
     * in production — the backfill scenario where the mapping exists first and the filings are ingested afterwards.
     */
    async function reset(): Promise<void> {
        for (const table of [
            'sec_13f_positions',
            'sec_13f_option_positions',
            'sec_13f_option_aggregates',
            'sec_13f_filings',
            'sec_13f_aggregates',
            'sec_13f_dirty_aggregates',
            'cusip_symbol_map',
            'investor_flows_state',
        ]) {
            await db.execute(sql.raw(`DELETE FROM ${table}`));
        }
        await mapCusip();
    }
    async function mapCusip(): Promise<void> {
        await new DrizzleInvestorFlowsUniverseRepository(
            db as never
        ).upsertCusipMap([{ cusip: C, symbol: 'TEST', source: 'fmp' }]);
        const rows = (await db.execute(
            sql`SELECT id FROM cusip_symbol_map WHERE cusip = ${C}`
        )) as unknown as { id: number }[];
        cusipId = rows[0]?.id as number;
    }
    /** Ingests one filing through the real `applyFiling` (positions + ledger row + dirty), like the ingester does. */
    const universeRepo = () =>
        new DrizzleInvestorFlowsUniverseRepository(db as never);
    const ingest = async (
        cik: number,
        period: string,
        shares: number | null,
        over: Record<string, unknown> = {}
    ) =>
        repo.applyFiling({
            accession: `T-${cik}-${period.slice(5, 7)}${over.suffix ?? ''}`,
            cik: String(cik).padStart(10, '0'),
            filingDate: '2026-10-01',
            submissionType: '13F-HR',
            amendmentType: null,
            period,
            filerName: `Filer ${cik}`,
            mode: 'merge',
            rows:
                shares === null
                    ? []
                    : [{ cusip: C, shares, valueUsd: shares * 1000 }],
            optionRows: [],
            cusipIds: new Map([[C, cusipId]]),
            firstForPeriod: false,
            // the snapshot stamp the real ingester takes from `loadUniverse` (DB clock), unless the test pins one
            universeStamp: (await universeRepo().loadUniverse()).loadedAt,
            ...over,
        } as never);
    /** A processed filing whose universe snapshot was taken just now (after the mapping made by `reset`). */
    const filed = (cik: number, period: string) =>
        db.execute(sql`INSERT INTO sec_13f_filings (accession, cik, period, filing_date, submission_type, processed_at, universe_stamp)
            VALUES (${`T-${cik}-${period.slice(5, 7)}`}, ${cik}, ${period}::date, '2026-10-01', '13F-HR', now(), now())`);
    const position = (cik: number, period: string, shares: number) =>
        db.execute(
            sql`INSERT INTO sec_13f_positions (shares, cik, cusip_id, period, value_k) VALUES (${shares}, ${cik}, ${cusipId}, ${period}::date, ${shares})`
        );
    const aggregate = async () =>
        (await db.execute(
            sql`SELECT * FROM sec_13f_aggregates WHERE cusip = ${C}`
        )) as unknown as Record<string, unknown>[];
    const dirty = async () =>
        (await db.execute(
            sql`SELECT period::text AS period, cusip_id FROM sec_13f_dirty_aggregates ORDER BY period, cusip_id`
        )) as unknown as { period: string; cusip_id: number }[];

    /**
     * prior (PREV): c1=100 c2=100 c3=100 c5=500  → 4 holders, 800 shares
     * current (CUR): c1=150 c2=50 c4=70          → 3 holders, 270 shares
     * filed CUR: c1 c2 c3 c4; filed PREV: c1 c2 c3 c5   (c3 filed CUR with no position, c5 stopped filing)
     */
    async function seedScenario(): Promise<void> {
        await reset();
        for (const cik of [1, 2, 3, 4]) await filed(cik, CUR);
        for (const cik of [1, 2, 3, 5]) await filed(cik, PREV);
        for (const [cik, shares] of [
            [1, 100],
            [2, 100],
            [3, 100],
            [5, 500],
        ] as const)
            await position(cik, PREV, shares);
        for (const [cik, shares] of [
            [1, 150],
            [2, 50],
            [4, 70],
        ] as const)
            await position(cik, CUR, shares);
    }

    const priorHolders = 4;
    const priorShares = 800;

    describe('complete mode: full previous quarter vs full current quarter', () => {
        it('counts filer churn as new/exited and satisfies priorHolders = holders − new + exited', async () => {
            await seedScenario();
            await repo.recomputeAggregates(CUR, [C], 'complete');
            const [row] = await aggregate();
            // new: c4. exited: c3 (filed, dropped) AND c5 (stopped filing) — symmetric with the full prior quarter
            expect(row).toMatchObject({
                holders: 3,
                shares: '270',
                new_holders: 1,
                increased: 1,
                decreased: 1,
                exited: 2,
                net_share_change: '-530',
            });
            expect(
                Number(row?.holders) -
                    Number(row?.new_holders) +
                    Number(row?.exited)
            ).toBe(priorHolders);
        });

        it('satisfies priorShares = shares − netShareChange', async () => {
            await seedScenario();
            await repo.recomputeAggregates(CUR, [C], 'complete');
            const [row] = await aggregate();
            expect(Number(row?.shares) - Number(row?.net_share_change)).toBe(
                priorShares
            );
        });

        it('stores value from thousands back to dollars', async () => {
            await seedScenario();
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect((await aggregate())[0]?.value_usd).toBe('270000');
        });
    });

    describe('panel mode: only filers present in both quarters (in-progress quarter)', () => {
        it('compares a consistent panel and satisfies both identities for the panel population', async () => {
            await seedScenario();
            await repo.recomputeAggregates(CUR, [C], 'panel');
            const [row] = await aggregate();
            // panel = filed CUR and PREV = c1 c2 c3. prior panel: 3 holders / 300 shares. current panel: c1=150 c2=50 → 2 / 200
            expect(row).toMatchObject({
                holders: 2,
                shares: '200',
                new_holders: 0,
                increased: 1,
                decreased: 1,
                exited: 1,
                net_share_change: '-100',
            });
            expect(
                Number(row?.holders) -
                    Number(row?.new_holders) +
                    Number(row?.exited)
            ).toBe(3);
            expect(Number(row?.shares) - Number(row?.net_share_change)).toBe(
                300
            );
        });

        it('is not biased by filers outside the panel (c4 new filer, c5 stopped filer)', async () => {
            await seedScenario();
            await repo.recomputeAggregates(CUR, [C], 'panel');
            const [row] = await aggregate();
            expect(row?.new_holders).toBe(0); // c4 is not "new" — it has no prior-quarter filing to compare
            expect(Number(row?.shares)).toBe(200); // c4's 70 shares are outside the panel
        });
    });

    describe('per-CUSIP baseline (the CUSIP must be in the universe snapshot the prior quarter was parsed against)', () => {
        it('BACKFILL ORDER: mapping created_at = now(), prior and current quarter ingested afterwards → changes are computed (the calendar-cutoff version returned NULL here)', async () => {
            await reset(); // mapped now, through upsertCusipMap
            for (const cik of [1, 2, 3]) await ingest(cik, PREV, 100);
            for (const [cik, shares] of [
                [1, 150],
                [4, 70],
            ] as const)
                await ingest(cik, CUR, shares);
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect((await aggregate())[0]).toMatchObject({
                holders: 2,
                new_holders: 1,
                increased: 1,
                decreased: 0,
                exited: 2,
                net_share_change: String(220 - 300),
            });
        });

        it('a CUSIP mapped AFTER the prior quarter was ingested has no baseline (its prior positions were never collected): change columns NULL, counts filled', async () => {
            await reset();
            await db.execute(sql`DELETE FROM cusip_symbol_map`);
            // the prior quarter's filings were parsed while the CUSIP was NOT in the universe: no positions were kept for it
            for (const cik of [1, 2, 3]) await filed(cik, PREV);
            await mapCusip(); // mapped now: later than the snapshot the prior quarter was parsed against
            await ingest(1, CUR, 150);
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect((await aggregate())[0]).toMatchObject({
                holders: 1,
                shares: '150',
                new_holders: null,
                increased: null,
                decreased: null,
                exited: null,
                net_share_change: null,
            });
        });

        it('a prior period with no processed filings at all gives no baseline either', async () => {
            await reset();
            await ingest(1, CUR, 150);
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect((await aggregate())[0]?.new_holders).toBeNull();
        });

        it('compares against the EARLIEST snapshot of the prior period (later stragglers do not move the reference)', async () => {
            await reset();
            await ingest(1, PREV, 100); // parsed right after the mapping
            // a straggler parsed even later does not matter; the earliest snapshot still contains the CUSIP
            await db.execute(
                sql`UPDATE sec_13f_filings SET universe_stamp = now() + interval '1 day' WHERE accession = 'T-1-03'`
            );
            await db.execute(
                sql`INSERT INTO sec_13f_filings (accession, cik, period, filing_date, submission_type, processed_at, universe_stamp) VALUES ('T-early', 8, ${PREV}::date, '2026-04-10', '13F-HR', now(), now() + interval '1 second')`
            );
            await ingest(1, CUR, 150);
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect((await aggregate())[0]?.new_holders).not.toBeNull();
        });

        it('ONE early filing parsed before the mapping is enough to void the baseline (min, not a later majority)', async () => {
            await reset();
            await db.execute(sql`DELETE FROM cusip_symbol_map`);
            await filed(1, PREV); // snapshot taken while the CUSIP was NOT mapped
            await mapCusip();
            await ingest(2, PREV, 100); // snapshot taken after the mapping
            await ingest(1, CUR, 150);
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect((await aggregate())[0]).toMatchObject({
                holders: 1,
                new_holders: null,
                net_share_change: null,
            });
        });

        it('OVERLAP: a mapping created while the prior filing was being parsed is NOT baselined (processed_at is later than the mapping, the snapshot is earlier)', async () => {
            await reset();
            // keep the universe non-empty so a snapshot exists, but without C
            await db.execute(sql`DELETE FROM cusip_symbol_map`);
            await universeRepo().upsertCusipMap([
                { cusip: '999999998', symbol: 'OTHER', source: 'fmp' },
            ]);
            const snapshot = await universeRepo().loadUniverse(); // the ingester loads the universe ...
            await mapCusip(); // ... and cusip-map maps C while the (long) download is still running ...
            await ingest(1, PREV, null, { universeStamp: snapshot.loadedAt }); // ... then the filing is applied with the OLD snapshot
            const [ledger] = (await db.execute(
                sql`SELECT (processed_at > (SELECT created_at FROM cusip_symbol_map WHERE cusip = ${C})) AS later FROM sec_13f_filings WHERE accession = 'T-1-03'`
            )) as unknown as { later: boolean }[];
            expect(ledger?.later).toBe(true); // a processed_at based rule would call this baselined
            await ingest(1, CUR, 150);
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect((await aggregate())[0]).toMatchObject({
                holders: 1,
                new_holders: null,
                increased: null,
                exited: null,
                net_share_change: null,
            });
        });

        it('CONTROL for the overlap case: the same flow with the mapping created BEFORE the snapshot is baselined', async () => {
            await reset();
            const snapshot = await universeRepo().loadUniverse(); // C already mapped
            await ingest(1, PREV, 100, { universeStamp: snapshot.loadedAt });
            await ingest(1, CUR, 150);
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect((await aggregate())[0]).toMatchObject({
                new_holders: 0,
                increased: 1,
            });
        });

        it('loadUniverse stamps the snapshot with the DB clock: a CUSIP mapped after it has created_at greater than the stamp', async () => {
            await reset();
            const snapshot = await universeRepo().loadUniverse();
            await universeRepo().upsertCusipMap([
                { cusip: '999999997', symbol: 'LATER', source: 'fmp' },
            ]);
            const [row] = (await db.execute(
                sql`SELECT (created_at > ${snapshot.loadedAt}::timestamptz) AS after FROM cusip_symbol_map WHERE cusip = '999999997'`
            )) as unknown as { after: boolean }[];
            expect(row?.after).toBe(true);
            expect(snapshot.cusips.has('999999997')).toBe(false);
        });
    });

    describe('housekeeping', () => {
        it('does not rewrite an identical recompute (IS DISTINCT FROM guard keeps computed_at)', async () => {
            await seedScenario();
            await repo.recomputeAggregates(CUR, [C], 'complete');
            const [first] = await aggregate();
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect((await aggregate())[0]?.computed_at).toEqual(
                first?.computed_at
            );
        });

        it('deletes the aggregate row when neither quarter has positions any more', async () => {
            await seedScenario();
            await repo.recomputeAggregates(CUR, [C], 'complete');
            await db.execute(sql`DELETE FROM sec_13f_positions`);
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect(await aggregate()).toEqual([]);
        });
    });

    describe('without a baseline', () => {
        it('writes counts only and leaves every change column NULL on a new row', async () => {
            await reset();
            await position(1, CUR, 1000);
            await repo.recomputeAggregates(CUR, [C], 'none');
            expect((await aggregate())[0]).toMatchObject({
                holders: 1,
                shares: '1000',
                new_holders: null,
                increased: null,
                decreased: null,
                exited: null,
                net_share_change: null,
            });
        });

        it('always refreshes holders / shares / value but leaves the existing change columns untouched', async () => {
            await reset();
            await filed(1, CUR);
            await filed(1, PREV);
            await position(1, CUR, 1000);
            await repo.recomputeAggregates(CUR, [C], 'complete');
            const before = (await aggregate())[0];
            await position(2, CUR, 500);
            await repo.recomputeAggregates(CUR, [C], 'none');
            const after = (await aggregate())[0];
            expect(after).toMatchObject({
                holders: 2,
                shares: '1500',
                value_usd: '1500000',
            }); // counts follow the data
            expect({
                n: after?.new_holders,
                i: after?.increased,
                d: after?.decreased,
                e: after?.exited,
                net: after?.net_share_change,
            }).toEqual({
                n: before?.new_holders,
                i: before?.increased,
                d: before?.decreased,
                e: before?.exited,
                net: before?.net_share_change,
            }); // change columns untouched
        });

        it('resetAggregateChanges then clears the stale change columns', async () => {
            await reset();
            await filed(1, CUR);
            await filed(1, PREV);
            await position(1, CUR, 1000);
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect(await repo.resetAggregateChanges(CUR)).toBe(1);
            expect((await aggregate())[0]).toMatchObject({
                holders: 1,
                new_holders: null,
                net_share_change: null,
            });
        });
    });

    describe('durable dirty queue (written in the applyFiling transaction)', () => {
        const base = (over: Record<string, unknown> = {}) => ({
            accession: '0000000002-26-000001',
            cik: '0000000002',
            filingDate: '2026-08-01',
            submissionType: '13F-HR',
            amendmentType: null,
            period: CUR,
            filerName: 'Filer Two',
            mode: 'merge' as const,
            rows: [{ cusip: C, shares: 50, valueUsd: 5_000 }],
            optionRows: [],
            firstForPeriod: false,
            universeStamp: STAMP,
            ...over,
        });

        it('marks the written (period, cusip) dirty together with the positions', async () => {
            await reset();
            await repo.applyFiling({
                ...base(),
                cusipIds: new Map([[C, cusipId]]),
            });
            expect(await dirty()).toEqual([{ period: CUR, cusip_id: cusipId }]);
        });

        it('a first filing of a filer also marks that filer’s prior-quarter CUSIPs dirty for the current quarter (so a dropped holding recomputes as exited)', async () => {
            await reset();
            await position(2, PREV, 100);
            await repo.applyFiling({
                ...base({ rows: [], firstForPeriod: true }),
                cusipIds: new Map([[C, cusipId]]),
            });
            expect(await dirty()).toEqual([{ period: CUR, cusip_id: cusipId }]);
        });

        it('a replace marks the positions it removes dirty too', async () => {
            await reset();
            await position(2, CUR, 100);
            await repo.applyFiling({
                ...base({ mode: 'replace', rows: [] }),
                cusipIds: new Map([[C, cusipId]]),
            });
            expect(await dirty()).toEqual([{ period: CUR, cusip_id: cusipId }]);
            expect(
                (
                    (await db.execute(
                        sql`SELECT count(*)::int AS n FROM sec_13f_positions`
                    )) as unknown as { n: number }[]
                )[0]?.n
            ).toBe(0);
        });

        it('takeDirty returns the oldest period first and clearDirty removes only the given rows', async () => {
            await reset();
            await db.execute(
                sql`INSERT INTO sec_13f_dirty_aggregates (period, cusip_id) VALUES (${CUR}::date, ${cusipId}), (${PREV}::date, ${cusipId})`
            );
            const batch = await repo.takeDirty(10);
            expect(batch?.period).toBe(PREV);
            expect(batch?.entries).toEqual([
                { id: cusipId, cusip: C, symbol: 'TEST' },
            ]);
            await repo.clearDirty(PREV, [cusipId]);
            expect(await dirty()).toEqual([{ period: CUR, cusip_id: cusipId }]);
        });
    });

    describe('13F option positions and put/call aggregates', () => {
        const optionAggregate = async () =>
            (await db.execute(
                sql`SELECT put_holders, put_shares::text AS put_shares, put_value_usd::text AS put_value_usd,
                           call_holders, call_shares::text AS call_shares, call_value_usd::text AS call_value_usd
                    FROM sec_13f_option_aggregates WHERE cusip = ${C} AND period = ${CUR}::date`
            )) as unknown as Record<string, unknown>[];
        const options = (
            puts: number | null,
            calls: number | null
        ): {
            cusip: string;
            putCall: 'put' | 'call';
            shares: number;
            valueUsd: number;
        }[] => [
            ...(puts === null
                ? []
                : [
                      {
                          cusip: C,
                          putCall: 'put' as const,
                          shares: puts,
                          valueUsd: puts * 10,
                      },
                  ]),
            ...(calls === null
                ? []
                : [
                      {
                          cusip: C,
                          putCall: 'call' as const,
                          shares: calls,
                          valueUsd: calls * 10,
                      },
                  ]),
        ];

        it('stores option rows through applyFiling, marks them dirty, and sums puts and calls per filer count', async () => {
            await reset();
            await ingest(1, CUR, 100, { optionRows: options(300, 40) });
            await ingest(2, CUR, null, { optionRows: options(null, 60) });
            await ingest(3, CUR, null, { optionRows: options(5, null) });
            expect(await dirty()).toEqual([{ period: CUR, cusip_id: cusipId }]);
            await repo.recomputeAggregates(CUR, [C], 'none');
            expect(await optionAggregate()).toEqual([
                {
                    put_holders: 2,
                    put_shares: '305',
                    put_value_usd: '3050',
                    call_holders: 2,
                    call_shares: '100',
                    call_value_usd: '1000',
                },
            ]);
        });

        it('a RESTATEMENT replace removes the filer’s old option rows (dirty) and the recompute drops an emptied aggregate', async () => {
            await reset();
            await ingest(1, CUR, 100, { optionRows: options(300, null) });
            await repo.recomputeAggregates(CUR, [C], 'none');
            expect(await optionAggregate()).toHaveLength(1);
            await db.execute(sql`DELETE FROM sec_13f_dirty_aggregates`);
            await ingest(1, CUR, 100, {
                suffix: '-A',
                mode: 'replace',
                amendmentType: 'RESTATEMENT',
                optionRows: [],
            });
            expect(await dirty()).toEqual([{ period: CUR, cusip_id: cusipId }]);
            await repo.recomputeAggregates(CUR, [C], 'none');
            expect(await optionAggregate()).toEqual([]);
        });

        it('a merge with unchanged option values does not mark the CUSIP dirty again', async () => {
            await reset();
            await ingest(1, CUR, null, { optionRows: options(300, null) });
            await db.execute(sql`DELETE FROM sec_13f_dirty_aggregates`);
            await ingest(1, CUR, null, {
                suffix: '-again',
                optionRows: options(300, null),
            });
            expect(await dirty()).toEqual([]);
        });

        it('prunes option positions with the positions floor and option aggregates with the aggregate cutoff', async () => {
            await reset();
            await ingest(1, PREV, null, { optionRows: options(10, 10) });
            await ingest(1, CUR, null, { optionRows: options(20, 20) });
            await repo.recomputeAggregates(PREV, [C], 'none');
            const pruned = await repo.prunePositionsBefore(CUR, () => false);
            expect(pruned).toEqual({ deleted: 2, done: true });
            const left = (await db.execute(
                sql`SELECT period::text AS period FROM sec_13f_option_positions ORDER BY period, put_call`
            )) as unknown as { period: string }[];
            expect(left.map(r => r.period)).toEqual([CUR, CUR]);
            expect(await repo.pruneAggregatesBefore(CUR)).toBe(1);
        });
    });

    describe('batched prune', () => {
        it('deletes everything below the floor in ctid batches, counts via the driver, keeps newer periods', async () => {
            await reset();
            const rows = INVESTOR_FLOWS_PRUNE_BATCH_SIZE + 1_000;
            await db.execute(sql`INSERT INTO sec_13f_positions (shares, cik, cusip_id, period, value_k)
                SELECT 1, g, ${cusipId}, ${'2025-12-31'}::date, 1 FROM generate_series(1, ${rows}) g`);
            await position(1, CUR, 5);
            const result = await repo.prunePositionsBefore(PREV, () => false);
            expect(result).toEqual({ deleted: rows, done: true });
            expect(
                (
                    (await db.execute(
                        sql`SELECT count(*)::int AS n FROM sec_13f_positions`
                    )) as unknown as { n: number }[]
                )[0]?.n
            ).toBe(1);
        });

        it('stops when told to and reports not done (the next run continues)', async () => {
            await reset();
            await db.execute(sql`INSERT INTO sec_13f_positions (shares, cik, cusip_id, period, value_k)
                SELECT 1, g, ${cusipId}, ${'2025-12-31'}::date, 1 FROM generate_series(1, ${INVESTOR_FLOWS_PRUNE_BATCH_SIZE * 2}) g`);
            let calls = 0;
            const result = await repo.prunePositionsBefore(
                PREV,
                () => calls++ >= 1
            );
            expect(result).toEqual({
                deleted: INVESTOR_FLOWS_PRUNE_BATCH_SIZE,
                done: false,
            });
        });

        it('persists key/value state', async () => {
            await reset();
            expect(await repo.getState('k')).toBeNull();
            await repo.setState('k', 'v1');
            await repo.setState('k', 'v2');
            expect(await repo.getState('k')).toBe('v2');
        });
    });

    describe('RESTATEMENT replace + later NEW HOLDINGS re-apply in ONE transaction', () => {
        const base = () => ({
            accession: '0001768130-26-000005',
            cik: '0000000007',
            filingDate: '2026-10-10',
            submissionType: '13F-HR/A',
            amendmentType: 'RESTATEMENT' as const,
            period: CUR,
            filerName: 'Filer Seven',
            mode: 'replace' as const,
            optionRows: [],
            firstForPeriod: false,
            universeStamp: STAMP,
        });
        const positionsOf = async () =>
            (await db.execute(
                sql`SELECT shares::text AS shares FROM sec_13f_positions WHERE cik = 7 ORDER BY shares`
            )) as unknown as { shares: string }[];

        it('the restatement replaces the old positions and the later amendment’s positions are layered back on top', async () => {
            await reset();
            await position(7, CUR, 111); // stale position the restatement removes
            await repo.applyFiling({
                ...base(),
                rows: [{ cusip: C, shares: 500, valueUsd: 500_000 }],
                reapply: [],
                cusipIds: new Map([[C, cusipId]]),
            });
            expect(await positionsOf()).toEqual([{ shares: '500' }]);
        });

        it('rolls EVERYTHING back when the re-apply fails: old positions intact, restatement not recorded as processed', async () => {
            await reset();
            await position(7, CUR, 111);
            await expect(
                repo.applyFiling({
                    ...base(),
                    rows: [{ cusip: C, shares: 500, valueUsd: 500_000 }],
                    // a share count that overflows bigint makes the re-apply insert fail after the replace already ran
                    reapply: [
                        {
                            accession: '0001768130-26-000020',
                            rows: [{ cusip: C, shares: 1e30, valueUsd: 1 }],
                            optionRows: [],
                        },
                    ],
                    cusipIds: new Map([[C, cusipId]]),
                })
            ).rejects.toThrow();
            expect(await positionsOf()).toEqual([{ shares: '111' }]); // the replace did not stick
            const ledger = (await db.execute(
                sql`SELECT count(*)::int AS n FROM sec_13f_filings WHERE accession = '0001768130-26-000005'`
            )) as unknown as { n: number }[];
            expect(ledger[0]?.n).toBe(0);
        });
    });

    describe('dirty marking around a filer’s first filing of a period', () => {
        it('also queues the filer’s positions of the NEXT quarter (its panel membership for that quarter changed)', async () => {
            await reset();
            await position(7, '2026-09-30', 40); // the filer already filed the next quarter
            await repo.applyFiling({
                accession: 'T-first',
                cik: '0000000007',
                filingDate: '2026-08-01',
                submissionType: '13F-HR',
                amendmentType: null,
                period: CUR,
                filerName: 'Filer Seven',
                mode: 'merge',
                rows: [],
                optionRows: [],
                cusipIds: new Map([[C, cusipId]]),
                firstForPeriod: true,
                universeStamp: STAMP,
            });
            expect(await dirty()).toEqual([
                { period: '2026-09-30', cusip_id: cusipId },
            ]);
        });

        it('markPeriodDirty queues every CUSIP that has positions in the period', async () => {
            await reset();
            await position(1, CUR, 10);
            await position(2, CUR, 20);
            expect(await repo.markPeriodDirty(CUR)).toBe(1); // one distinct CUSIP
            expect(await dirty()).toEqual([{ period: CUR, cusip_id: cusipId }]);
        });
    });

    describe('late-mapping recovery: deleting the ledger window makes the cursor restart and the filings re-readable', () => {
        const ledgerRow = (
            accession: string,
            date: string,
            processed: boolean
        ) =>
            db.execute(sql`INSERT INTO sec_13f_filings (accession, cik, period, filing_date, submission_type, processed_at, universe_stamp)
                VALUES (${accession}, 1, ${PREV}::date, ${date}::date, '13F-HR', ${processed ? sql`now()` : sql`NULL`}, ${processed ? sql`now()` : sql`NULL`})`);

        it('counts and deletes only ledger rows on/after the date; positions and aggregates stay; the cursor falls back below the window', async () => {
            await reset();
            await ledgerRow('OLD', '2026-01-10', true);
            await ledgerRow('IN-1', '2026-04-10', true);
            await ledgerRow('IN-2', '2026-10-10', true);
            await ledgerRow('IN-FAILED', '2026-10-11', false);
            await position(1, PREV, 100);
            await repo.recomputeAggregates(PREV, [C], 'none');
            expect(await repo.latestFilingDate()).toBe('2026-10-11');

            expect(await repo.countLedgerSince('2026-03-29')).toEqual({
                rows: 3,
                processed: 2,
                unprocessed: 1,
            });
            expect(await repo.deleteLedgerSince('2026-03-29')).toBe(3);

            expect(await repo.latestFilingDate()).toBe('2026-01-10'); // < window start → sec-13f restarts there
            expect(await repo.countLedgerSince('2026-03-29')).toEqual({
                rows: 0,
                processed: 0,
                unprocessed: 0,
            });
            expect(
                (
                    (await db.execute(
                        sql`SELECT (SELECT count(*) FROM sec_13f_positions)::int AS p, (SELECT count(*) FROM sec_13f_aggregates)::int AS a`
                    )) as unknown as { p: number; a: number }[]
                )[0]
            ).toEqual({ p: 1, a: 1 });
        });

        it('hasPositions tells a re-read (positions without ledger) from a first-time filing', async () => {
            await reset();
            expect(await repo.hasPositions('0000000001', PREV)).toBe(false);
            await ingest(1, PREV, 100);
            expect(await repo.hasPositions('0000000001', PREV)).toBe(true);
            expect(await repo.hasPositions('0000000001', CUR)).toBe(false);
            expect(await repo.hasPositions('0000000002', PREV)).toBe(false);
            await repo.deleteLedgerSince('2026-01-01');
            expect(await repo.hasPositions('0000000001', PREV)).toBe(true); // positions survive the ledger delete
        });

        it('re-applying an already-processed accession moves its universe stamp to the new snapshot (conflict path)', async () => {
            await reset();
            await ingest(1, PREV, 100, {
                universeStamp: '2026-01-01 00:00:00+00',
            });
            await ingest(1, PREV, 100, {
                universeStamp: '2026-06-01 00:00:00+00',
            });
            const [row] = (await db.execute(
                sql`SELECT universe_stamp = '2026-06-01 00:00:00+00'::timestamptz AS moved, (SELECT count(*) FROM sec_13f_filings)::int AS n FROM sec_13f_filings WHERE accession = 'T-1-03'`
            )) as unknown as { moved: boolean; n: number }[];
            expect(row).toEqual({ moved: true, n: 1 });
        });

        it('a re-read filing is applied again (idempotent) and its stamp moves to the NEW universe snapshot, which then baselines the late-mapped CUSIP', async () => {
            await reset();
            await db.execute(sql`DELETE FROM cusip_symbol_map`);
            await ingest(1, PREV, null); // parsed BEFORE C was mapped → no position for C
            await mapCusip(); // late mapping
            await ingest(1, CUR, 150);
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect((await aggregate())[0]?.new_holders).toBeNull(); // no baseline yet

            await repo.deleteLedgerSince('2026-01-01'); // the recovery script
            await ingest(1, PREV, 100); // sec-13f re-reads the prior-quarter filing with the new universe
            await ingest(1, CUR, 150);
            await repo.recomputeAggregates(CUR, [C], 'complete');
            expect((await aggregate())[0]).toMatchObject({
                holders: 1,
                new_holders: 0,
                increased: 1,
            });
        });
    });

    describe('backfill scenario end to end (real repositories, fake SEC): the latest complete quarter is baselined', () => {
        const NOW = new Date('2026-10-15T12:00:00Z');
        const infoTable =
            `<informationTable><infoTable><nameOfIssuer>TEST</nameOfIssuer><cusip>${C}</cusip><value>50000</value>` +
            '<shrsOrPrnAmt><sshPrnamt>50</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt></infoTable></informationTable>';

        it('mapping first, then the Q1 baseline season, then a Q2 filing: Q2 is computed as complete with real new/exited counts', async () => {
            await reset(); // mapping created now (upsertCusipMap)
            // Q1 = the prior quarter: 1,000 processed filers (the baseline threshold), three of them hold the CUSIP
            await db.execute(sql`INSERT INTO sec_13f_filings (accession, cik, period, filing_date, submission_type, processed_at, universe_stamp)
                SELECT 'Q1-' || g, g, ${PREV}::date, '2026-05-01', '13F-HR', now(), now() FROM generate_series(1, 1000) g`);
            // cusip-map finished its full pass (the gate sec-13f checks first)
            await repo.setState(
                INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
                '2026-10-01T00:00:00.000Z'
            );
            for (const cik of [1, 2, 3]) await position(cik, PREV, 100);

            const universe = new DrizzleInvestorFlowsUniverseRepository(
                db as never
            );
            const result = await run13fIngest({
                sec: {
                    fetchDailyFormIndex: async date =>
                        date === '2026-10-14'
                            ? `13F-HR           New Filer LLC                                                  5           20261014    edgar/data/5/0000000005-26-000001.txt`
                            : null,
                    fetchFilingIndexJson: async () => FILING_INDEX_JSON,
                    fetchFilingDocumentText: async () =>
                        PRIMARY_DOC_ORIGINAL.replaceAll(
                            '09-30-2026',
                            '06-30-2026'
                        ),
                    fetchFilingDocumentStream: async () =>
                        (async function* () {
                            yield new TextEncoder().encode(infoTable);
                        })(),
                },
                repo,
                loadUniverse: () => universe.loadUniverse(),
                isSecBlockedError: () => false,
                now: () => NOW,
                isDeadlineReached: () => false,
                invalidateSymbols: () => undefined,
                log: () => undefined,
            });
            expect(result).toMatchObject({
                stoppedBy: 'complete',
                filingsProcessed: 1,
                filingsFailed: 0,
            });
            // Q2 is complete at 2026-10-15; holders: the new filer only; new 1; exited 3 (full prior quarter); net 50 − 300
            expect((await aggregate())[0]).toMatchObject({
                holders: 1,
                shares: '50',
                new_holders: 1,
                increased: 0,
                decreased: 0,
                exited: 3,
                net_share_change: '-250',
            });
            expect(await repo.getState('sec13f_period_mode:2026-06-30')).toBe(
                'complete'
            );
            expect(await dirty()).toEqual([]);
        });
    });
});
