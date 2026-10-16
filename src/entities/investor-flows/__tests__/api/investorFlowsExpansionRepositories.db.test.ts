import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeTarget } from '../../../../../db/scripts/lib/dbTarget';
import * as schema from '@/shared/db/schema';
import { DrizzleSecFilingsRepository } from '../../api/investorFlowsFilingsRepository';
import { DrizzleInvestorFlowsFtdRepository } from '../../api/investorFlowsFtdRepository';
import { DrizzleInvestorFlowsRegShoRepository } from '../../api/investorFlowsRegShoRepository';
import { INVESTOR_FLOWS_STATE_REG_SHO_CURSOR } from '../../lib/investorFlowsPolicy';
import { serializeRegShoCursor } from '../../lib/regShoCursor';
import type { Form144Row } from '../../model';

vi.mock('server-only', () => ({}));

/**
 * 수급 확장 저장소(FTD·Form 144·증자 공시·CIK 맵·Reg SHO)의 SQL을 **진짜 Postgres**에서 검증한다 — 합산·교체·조인은 렌더
 * 문자열로는 의미를 못 본다(TESTING.md#TE-55). `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker compose -p <name> -f docker-compose.e2e.yml up -d --pull never postgres
 *   TEST_DATABASE_URL=postgres://siglens:siglens@localhost:5433/siglens_e2e yarn test .db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 `0048`·`0049`를 적용한 뒤 끝나면 스키마를 지운다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `investor_flows_expansion_test_${process.pid}`;
const MIGRATIONS = [
    '0048_investor_flows_data.sql',
    '0049_investor_flows_expansion.sql',
].map(file => path.join(process.cwd(), 'drizzle', file));

const form144 = (over: Partial<Form144Row> = {}): Form144Row => ({
    accession: '0001950047-26-010251',
    issuerCik: 1652044,
    symbol: 'GOOG',
    filerName: 'Insider One',
    relationships: ['Officer', 'Director'],
    securityClass: 'Class C Capital Stock',
    shares: 17262,
    valueUsd: 9333573,
    sharesOutstanding: 1632475042,
    approxSaleDate: '2026-10-15',
    planAdoptionDate: '2026-05-20',
    broker: 'Broker LLC',
    formType: '144',
    filingDate: '2026-10-15',
    ...over,
});

describe.skipIf(!URL)(
    'investor flows expansion repositories on a real Postgres',
    () => {
        let admin: postgres.Sql;
        let client: postgres.Sql;
        let db: ReturnType<typeof drizzle<typeof schema>>;

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
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        async function clear(...tables: string[]): Promise<void> {
            for (const table of tables) {
                await db.execute(sql.raw(`DELETE FROM ${table}`));
            }
        }

        describe('sec_cik_symbol_map replacement', () => {
            it('keeps the pairs of the new list and deletes the pairs missing from it, in one transaction', async () => {
                await clear('sec_cik_symbol_map');
                const repo = new DrizzleSecFilingsRepository(db as never);
                await repo.replaceCikSymbolMap([
                    { cik: 1652044, symbol: 'GOOG' },
                    { cik: 1652044, symbol: 'GOOGL' },
                    { cik: 9999, symbol: 'GONE' },
                ]);
                const result = await repo.replaceCikSymbolMap([
                    { cik: 1652044, symbol: 'GOOG' },
                    { cik: 1652044, symbol: 'GOOGL' },
                    { cik: 2488, symbol: 'AMD' },
                ]);
                expect(result).toEqual({ upserted: 3, deleted: 1 });
                expect([...(await repo.loadCikSymbols())]).toEqual([
                    [2488, ['AMD']],
                    [1652044, ['GOOG', 'GOOGL']],
                ]);
            });
        });

        describe('Form 144', () => {
            it('finds an issuer’s filings from EVERY share class through the CIK map', async () => {
                await clear(
                    'sec_cik_symbol_map',
                    'sec_form144',
                    'sec_filings_failures'
                );
                const repo = new DrizzleSecFilingsRepository(db as never);
                await repo.replaceCikSymbolMap([
                    { cik: 1652044, symbol: 'GOOG' },
                    { cik: 1652044, symbol: 'GOOGL' },
                ]);
                await repo.upsertForm144([form144()]);
                const sales = await repo.findProposedSales(
                    'GOOGL',
                    '2026-01-01',
                    5
                );
                expect(sales).toEqual([
                    {
                        accession: '0001950047-26-010251',
                        filingDate: '2026-10-15',
                        formType: '144',
                        filer: 'Insider One',
                        relationships: ['Officer', 'Director'],
                        shares: 17262,
                        valueUsd: 9333573,
                        approxSaleDate: '2026-10-15',
                        planAdoptionDate: '2026-05-20',
                        url: 'https://www.sec.gov/Archives/edgar/data/1652044/000195004726010251/0001950047-26-010251-index.htm',
                    },
                ]);
            });

            it('clears the retry record of an accession once it is stored', async () => {
                await clear('sec_form144', 'sec_filings_failures');
                const repo = new DrizzleSecFilingsRepository(db as never);
                const target = {
                    accession: '0001950047-26-010251',
                    cik: '0001652044',
                    formType: '144',
                    filingDate: '2026-10-15',
                };
                await repo.recordFailure(target, 'timeout');
                await repo.recordFailure(target, 'timeout again');
                expect(await repo.listRetries(3, 10)).toEqual([
                    { ...target, attempts: 2 },
                ]);
                await repo.upsertForm144([form144()]);
                expect(await repo.listRetries(3, 10)).toEqual([]);
            });

            it('keeps a negative marker out of the retry queue and the failed backlog', async () => {
                await clear('sec_filings_failures');
                const repo = new DrizzleSecFilingsRepository(db as never);
                const target = {
                    accession: '0001950047-26-010261',
                    cik: '0001650372',
                    formType: '144',
                    filingDate: '2026-10-15',
                };
                await repo.recordSkipped(
                    target,
                    'issuer outside the universe',
                    3
                );
                expect(await repo.listRetries(3, 10)).toEqual([]);
                expect(await repo.countExhaustedFailures(3)).toBe(0);
                expect([
                    ...(await repo.findFailureAttempts([target.accession])),
                ]).toEqual([[target.accession, 3]]);
            });

            it('prunes by filing date per table', async () => {
                await clear(
                    'sec_form144',
                    'sec_offering_filings',
                    'sec_filings_failures'
                );
                const repo = new DrizzleSecFilingsRepository(db as never);
                await repo.upsertForm144([
                    form144(),
                    form144({ accession: 'OLD-144', filingDate: '2025-01-01' }),
                ]);
                expect(
                    await repo.pruneBefore({
                        form144Before: '2025-10-15',
                        offeringsBefore: '2024-10-15',
                        failuresBefore: '2025-10-15',
                    })
                ).toEqual({ form144: 1, offerings: 0, failures: 0 });
            });
        });

        describe('offerings', () => {
            it('stores one row per (accession, symbol) and reads a symbol’s filings newest first', async () => {
                await clear('sec_offering_filings');
                const repo = new DrizzleSecFilingsRepository(db as never);
                const row = {
                    issuerCik: 920760,
                    formType: '424B5',
                    kind: 'underwritten' as const,
                    url: 'u',
                };
                await repo.upsertOfferings([
                    {
                        ...row,
                        accession: 'A-1',
                        symbol: 'LEN',
                        filingDate: '2026-09-01',
                    },
                    {
                        ...row,
                        accession: 'A-1',
                        symbol: 'LEN-B',
                        filingDate: '2026-09-01',
                    },
                    {
                        ...row,
                        accession: 'A-2',
                        symbol: 'LEN',
                        filingDate: '2026-10-01',
                        kind: 'shelf',
                    },
                ]);
                expect(await repo.findStoredOfferings(['A-1', 'A-9'])).toEqual(
                    new Set(['A-1'])
                );
                const found = await repo.findOfferings('LEN', '2026-01-01', 5);
                expect(found.map(f => `${f.accession}:${f.kind}`)).toEqual([
                    'A-2:shelf',
                    'A-1:underwritten',
                ]);
            });
        });

        describe('fails-to-deliver', () => {
            it('stores a file atomically with its marker and sums a symbol’s CUSIPs per settlement date', async () => {
                await clear('sec_ftd', 'sec_ftd_files');
                const repo = new DrizzleInvestorFlowsFtdRepository(db as never);
                await repo.storeFile('202609b', [
                    {
                        cusip: '037833100',
                        settlementDate: '2026-09-15',
                        symbol: 'AAPL',
                        failsQty: 201,
                        price: 333.08,
                    },
                    // a second CUSIP of the same symbol on the same day (after a CUSIP change)
                    {
                        cusip: '037833209',
                        settlementDate: '2026-09-15',
                        symbol: 'AAPL',
                        failsQty: 99,
                        price: null,
                    },
                    {
                        cusip: '037833100',
                        settlementDate: '2026-09-16',
                        symbol: 'AAPL',
                        failsQty: 100,
                        price: 331.34,
                    },
                ]);
                expect([...(await repo.listFileStates())]).toEqual([
                    ['202609b', { processed: true, attempts: 0 }],
                ]);
                expect(
                    await repo.findFailsToDeliver('AAPL', '2026-09-01')
                ).toEqual([
                    {
                        settlementDate: '2026-09-15',
                        failsQty: 300,
                        price: 333.08,
                    },
                    {
                        settlementDate: '2026-09-16',
                        failsQty: 100,
                        price: 331.34,
                    },
                ]);
            });

            it('rolls the file back when a row fails, so the marker never says "stored" for a partial file', async () => {
                await clear('sec_ftd', 'sec_ftd_files');
                const repo = new DrizzleInvestorFlowsFtdRepository(db as never);
                await expect(
                    repo.storeFile('202609a', [
                        {
                            cusip: '037833100',
                            settlementDate: '2026-09-02',
                            symbol: 'AAPL',
                            failsQty: 1e30,
                            price: null,
                        },
                    ])
                ).rejects.toThrow();
                expect(await repo.listFileStates()).toEqual(new Map());
            });

            it('counts rejected attempts without marking the file processed, and a later store marks it processed', async () => {
                await clear('sec_ftd', 'sec_ftd_files');
                const repo = new DrizzleInvestorFlowsFtdRepository(db as never);
                await repo.recordRejected('202609b', 'trailer mismatch');
                await repo.recordRejected('202609b', 'trailer mismatch');
                expect([...(await repo.listFileStates())]).toEqual([
                    ['202609b', { processed: false, attempts: 2 }],
                ]);
                await repo.storeFile('202609b', []);
                expect([...(await repo.listFileStates())]).toEqual([
                    ['202609b', { processed: true, attempts: 2 }],
                ]);
            });

            it('prunes rows older than the cutoff', async () => {
                await clear('sec_ftd', 'sec_ftd_files');
                const repo = new DrizzleInvestorFlowsFtdRepository(db as never);
                await repo.storeFile('202409a', [
                    {
                        cusip: '037833100',
                        settlementDate: '2024-09-03',
                        symbol: 'AAPL',
                        failsQty: 5,
                        price: 1,
                    },
                ]);
                expect(await repo.pruneBefore('2024-10-01')).toBe(1);
            });
        });

        describe('Reg SHO threshold listings', () => {
            it('groups a symbol’s listings by trade date and reads the ingested dates from the cursor', async () => {
                await clear('reg_sho_threshold', 'investor_flows_state');
                const repo = new DrizzleInvestorFlowsRegShoRepository(
                    db as never
                );
                await repo.insertListings([
                    { symbol: 'GME', tradeDate: '2026-10-14', market: 'nyse' },
                    { symbol: 'GME', tradeDate: '2026-10-15', market: 'nyse' },
                    {
                        symbol: 'GME',
                        tradeDate: '2026-10-15',
                        market: 'cboe_bzx',
                    },
                    // a repeated insert is ignored
                    { symbol: 'GME', tradeDate: '2026-10-15', market: 'nyse' },
                ]);
                await repo.setState(
                    INVESTOR_FLOWS_STATE_REG_SHO_CURSOR,
                    serializeRegShoCursor(
                        {
                            lastByMarket: { nyse: '2026-10-15' },
                            ingestedDates: [
                                '2026-10-13',
                                '2026-10-14',
                                '2026-10-15',
                            ],
                        },
                        '2026-01-01'
                    )
                );
                expect(await repo.findListings('GME', '2026-10-01')).toEqual([
                    { tradeDate: '2026-10-14', markets: ['nyse'] },
                    { tradeDate: '2026-10-15', markets: ['cboe_bzx', 'nyse'] },
                ]);
                expect(await repo.listTradeDates('2026-10-14')).toEqual([
                    '2026-10-14',
                    '2026-10-15',
                ]);
                expect(await repo.pruneBefore('2026-10-15')).toBe(1);
            });
        });
    }
);
