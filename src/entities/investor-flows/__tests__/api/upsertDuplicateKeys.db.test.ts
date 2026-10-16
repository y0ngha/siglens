import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { describeTarget } from '../../../../../db/scripts/lib/dbTarget';
import * as schema from '@/shared/db/schema';
import { Drizzle13fRepository } from '../../api/investorFlows13fRepository';
import { DrizzleInvestorFlowsDartRepository } from '../../api/investorFlowsDartRepository';
import { DrizzleSecFilingsRepository } from '../../api/investorFlowsFilingsRepository';
import { DrizzleInvestorFlowsFtdRepository } from '../../api/investorFlowsFtdRepository';
import { DrizzleInvestorFlowsRegShoRepository } from '../../api/investorFlowsRegShoRepository';
import { DrizzleInvestorFlowsShortRepository } from '../../api/investorFlowsShortRepository';
import { DrizzleInvestorFlowsUniverseRepository } from '../../api/investorFlowsUniverseRepository';
import { INVESTOR_FLOWS_US_EXCHANGES } from '../../lib/investorFlowsPolicy';
import type {
    DartInsiderReportRow,
    DartMajorHoldingRow,
    DartTradingPlanRow,
    Form144Row,
    OfferingFilingRow,
} from '../../model';

vi.mock('server-only', () => ({}));

/**
 * 수급 저장소의 배치 upsert가 **한 입력 안의 중복 충돌 키**를 견디는지 진짜 Postgres에서 본다(TESTING.md#TE-55). 운영
 * `cusip-map`이 한 청크에 같은 CUSIP 두 행을 넣어 21000(`ON CONFLICT DO UPDATE command cannot affect row a second time`)으로
 * 실행 전체가 실패했다 — 렌더 SQL로는 이 오류가 보이지 않는다. 먼저 맨 문장이 실제로 21000을 내는지(전제) 확인하고, 각 저장소가
 * 같은 배치를 받아 한 행만 남기는지 확인한다. `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker compose -p <name> -f docker-compose.e2e.yml up -d --pull never postgres
 *   TEST_DATABASE_URL=postgres://siglens:siglens@localhost:5433/siglens_e2e yarn test .db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 실제 마이그레이션(`korean_tickers` 생성·`delisted_at` 추가·`0048`~`0051`)을
 * 적용한 뒤 끝나면 스키마를 지운다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `investor_flows_dupkeys_test_${process.pid}`;
const migration = (file: string): string =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8');
const statements = (text: string): string[] =>
    text.split('--> statement-breakpoint');
const DDL = statements(migration('0000_absent_kid_colt.sql'))
    .filter(statement => statement.includes('CREATE TABLE "korean_tickers"'))
    .concat(
        [
            '0028_lush_wendell_vaughn.sql',
            '0048_investor_flows_data.sql',
            '0049_investor_flows_expansion.sql',
            '0050_form144_filer_cik.sql',
            '0051_kr_listed_shares.sql',
        ].flatMap(file => statements(migration(file)))
    );

const SHARED = '084670702';
const CORP = '00126380';

const major = (
    over: Partial<DartMajorHoldingRow> = {}
): DartMajorHoldingRow => ({
    rceptNo: '20260311000555',
    corpCode: CORP,
    receiptDate: '2026-03-11',
    reporter: '국민연금공단',
    reportForm: 'detailed',
    shares: 432_154_213,
    sharesChange: -25_165_617,
    ratioPct: 7.24,
    ratioChangePct: -0.36,
    reason: '보유주식등의 수 변동',
    ...over,
});

const insider = (
    over: Partial<DartInsiderReportRow> = {}
): DartInsiderReportRow => ({
    rceptNo: '20261002000321',
    corpCode: CORP,
    receiptDate: '2026-10-02',
    reporter: '홍길동',
    position: '사내이사',
    registered: true,
    majorShareholder: null,
    shares: 12_000,
    sharesChange: 2_000,
    ratioPct: 0.0123,
    ratioChangePct: null,
    ...over,
});

const plan = (over: Partial<DartTradingPlanRow> = {}): DartTradingPlanRow => ({
    rceptNo: '20261014000789',
    corpCode: CORP,
    receiptDate: '2026-10-14',
    reporter: '이임원',
    title: '임원ㆍ주요주주특정증권등거래계획보고서',
    ...over,
});

const offering = (
    over: Partial<OfferingFilingRow> = {}
): OfferingFilingRow => ({
    accession: '0001193125-26-100001',
    symbol: 'BRK-B',
    issuerCik: 1067983,
    formType: 'S-3ASR',
    filingDate: '2026-10-15',
    kind: 'shelf',
    url: 'https://www.sec.gov/Archives/edgar/data/1067983/000119312526100001/0001193125-26-100001-index.htm',
    ...over,
});

const form144 = (over: Partial<Form144Row> = {}): Form144Row => ({
    accession: '0001950047-26-010251',
    issuerCik: 1652044,
    symbol: 'GOOG',
    filerName: 'Insider One',
    filerCik: '0001622864',
    relationships: ['Officer'],
    securityClass: 'Class C Capital Stock',
    shares: 17262,
    valueUsd: 9333573,
    sharesOutstanding: 1632475042,
    approxSaleDate: '2026-10-15',
    planAdoptionDate: null,
    broker: 'Broker LLC',
    formType: '144',
    filingDate: '2026-10-15',
    ...over,
});

describe.skipIf(!URL)(
    'investor flows batch upserts with duplicate conflict keys on a real Postgres',
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
            for (const statement of DDL) await client.unsafe(statement);
            db = drizzle(client, { schema });
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        // 중복을 버린 저장소는 경고를 남긴다 — 테스트 출력은 조용히, 호출은 단언하지 않는다(경고 문구는 단위 테스트가 본다).
        let warn: ReturnType<typeof vi.spyOn>;
        beforeEach(() => {
            warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        });
        afterEach(() => {
            warn.mockRestore();
        });

        async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
            return (await db.execute(query)) as unknown as T[];
        }

        async function clear(...tables: string[]): Promise<void> {
            for (const table of tables) {
                await db.execute(sql.raw(`DELETE FROM ${table}`));
            }
        }

        describe('premise', () => {
            it('a bare ON CONFLICT DO UPDATE with the same key twice in one statement fails with 21000', async () => {
                await clear('cusip_symbol_map');
                await expect(
                    db.execute(sql`
                        INSERT INTO cusip_symbol_map (cusip, symbol, source)
                        VALUES (${SHARED}, 'BRK-B', 'fmp'), (${SHARED}, 'BRKB', 'fmp')
                        ON CONFLICT (cusip) DO UPDATE SET symbol = excluded.symbol`)
                ).rejects.toMatchObject({ cause: { code: '21000' } });
            });
        });

        describe('cusip_symbol_map', () => {
            const universe = (): DrizzleInvestorFlowsUniverseRepository =>
                new DrizzleInvestorFlowsUniverseRepository(db as never);
            const mapped = (): Promise<{ cusip: string; symbol: string }[]> =>
                rows(
                    sql`SELECT cusip, symbol FROM cusip_symbol_map ORDER BY cusip, symbol`
                );
            const listTicker = (symbol: string, delistedAt: Date | null) =>
                db.insert(schema.koreanTickers).values({
                    symbol,
                    koreanName: '이름',
                    name: 'Name',
                    exchange: INVESTOR_FLOWS_US_EXCHANGES[1] as string,
                    exchangeFullName: 'New York Stock Exchange',
                    delistedAt,
                });

            beforeEach(async () => {
                await clear('cusip_symbol_map', 'korean_tickers');
            });

            it('stores a batch holding one CUSIP under two symbols as one row (smallest symbol)', async () => {
                const result = await universe().upsertCusipMap([
                    { cusip: SHARED, symbol: 'BRKB', source: 'fmp' },
                    { cusip: '037833100', symbol: 'AAPL', source: 'fmp' },
                    { cusip: SHARED, symbol: 'BRK-B', source: 'fmp' },
                ]);
                expect(await mapped()).toEqual([
                    { cusip: '037833100', symbol: 'AAPL' },
                    { cusip: SHARED, symbol: 'BRK-B' },
                ]);
                expect(result.conflicts).toEqual([
                    { cusip: SHARED, kept: 'BRK-B', dropped: ['BRKB'] },
                ]);
            });

            it('keeps the mapped symbol against a later claimant while it is still listed', async () => {
                await listTicker('BRK-B', null);
                await universe().upsertCusipMap([
                    { cusip: SHARED, symbol: 'BRK-B', source: 'fmp' },
                ]);
                const result = await universe().upsertCusipMap([
                    { cusip: SHARED, symbol: 'BRKB', source: 'fmp' },
                ]);
                expect(await mapped()).toEqual([
                    { cusip: SHARED, symbol: 'BRK-B' },
                ]);
                expect(result.written).toEqual([]);
            });

            it('hands the CUSIP to the new symbol once the mapped one is delisted (ticker change)', async () => {
                await listTicker('FB', new Date('2022-06-09T00:00:00Z'));
                await universe().upsertCusipMap([
                    { cusip: '30303M102', symbol: 'FB', source: 'fmp' },
                ]);
                await universe().upsertCusipMap([
                    { cusip: '30303M102', symbol: 'META', source: 'fmp' },
                ]);
                expect(await mapped()).toEqual([
                    { cusip: '30303M102', symbol: 'META' },
                ]);
            });
        });

        describe('DART', () => {
            const dart = (): DrizzleInvestorFlowsDartRepository =>
                new DrizzleInvestorFlowsDartRepository(db as never);

            it('dart_trading_plans: the same receipt number twice keeps the last row', async () => {
                await clear('dart_trading_plans');
                await dart().upsertTradingPlans([
                    plan({ title: '첫 페이지' }),
                    plan({ title: '다음 페이지' }),
                ]);
                expect(
                    await rows(
                        sql`SELECT rcept_no, title FROM dart_trading_plans`
                    )
                ).toEqual([
                    { rcept_no: '20261014000789', title: '다음 페이지' },
                ]);
            });

            it('dart_major_holdings: the same (receipt, reporter) twice is stored once', async () => {
                await clear('dart_major_holdings');
                await dart().upsertMajorHoldings([
                    major({ shares: 1 }),
                    major({ shares: 2 }),
                ]);
                expect(
                    await rows(
                        sql`SELECT shares::int AS shares FROM dart_major_holdings`
                    )
                ).toEqual([{ shares: 2 }]);
            });

            it('dart_insider_reports: the same (receipt, reporter) twice is stored once', async () => {
                await clear('dart_insider_reports');
                await dart().upsertInsiderReports([
                    insider({ shares: 1 }),
                    insider({ shares: 2 }),
                ]);
                expect(
                    await rows(
                        sql`SELECT shares::int AS shares FROM dart_insider_reports`
                    )
                ).toEqual([{ shares: 2 }]);
            });

            it('dart_corp_code: the same stock code twice is stored once', async () => {
                await clear('dart_corp_code');
                await dart().upsertCorpCodes([
                    {
                        stockCode: '005930',
                        corpCode: CORP,
                        corpName: '옛 이름',
                    },
                    {
                        stockCode: '005930',
                        corpCode: CORP,
                        corpName: '삼성전자',
                    },
                ]);
                expect(
                    await rows(
                        sql`SELECT stock_code, corp_name FROM dart_corp_code`
                    )
                ).toEqual([{ stock_code: '005930', corp_name: '삼성전자' }]);
            });
        });

        describe('SEC filings', () => {
            const filings = (): DrizzleSecFilingsRepository =>
                new DrizzleSecFilingsRepository(db as never);

            it('sec_offering_filings: the same (accession, symbol) twice is stored once', async () => {
                await clear('sec_offering_filings', 'sec_filings_failures');
                await filings().upsertOfferings([
                    offering({ issuerCik: 1067983 }),
                    offering({ issuerCik: 2000001 }),
                ]);
                expect(
                    await rows(
                        sql`SELECT accession, symbol, issuer_cik FROM sec_offering_filings`
                    )
                ).toEqual([
                    {
                        accession: '0001193125-26-100001',
                        symbol: 'BRK-B',
                        issuer_cik: 2000001,
                    },
                ]);
            });

            it('sec_cik_symbol_map: the same pair twice is stored once and counted once', async () => {
                await clear('sec_cik_symbol_map');
                const result = await filings().replaceCikSymbolMap([
                    { cik: 1652044, symbol: 'GOOG' },
                    { cik: 1652044, symbol: 'GOOG' },
                ]);
                expect(result).toEqual({ upserted: 1, deleted: 0 });
            });

            it('sec_form144 (ON CONFLICT DO NOTHING) already tolerates the same accession twice', async () => {
                await clear('sec_form144', 'sec_filings_failures');
                await filings().upsertForm144([form144(), form144()]);
                expect(
                    await rows(sql`SELECT accession FROM sec_form144`)
                ).toEqual([{ accession: '0001950047-26-010251' }]);
            });
        });

        it('sec_ftd: the same (CUSIP, settlement date) twice is stored once and the file row count matches', async () => {
            await clear('sec_ftd', 'sec_ftd_files');
            await new DrizzleInvestorFlowsFtdRepository(db as never).storeFile(
                '202610a',
                [
                    {
                        cusip: SHARED,
                        settlementDate: '2026-10-01',
                        symbol: 'BRK-B',
                        failsQty: 100,
                        price: 480.5,
                    },
                    {
                        cusip: SHARED,
                        settlementDate: '2026-10-01',
                        symbol: 'BRK-B',
                        failsQty: 300,
                        price: 481.25,
                    },
                ]
            );
            expect(
                await rows(sql`SELECT fails_qty::int AS fails_qty FROM sec_ftd`)
            ).toEqual([{ fails_qty: 300 }]);
            expect(
                await rows(sql`SELECT row_count FROM sec_ftd_files`)
            ).toEqual([{ row_count: 1 }]);
        });

        describe('FINRA', () => {
            const short = (): DrizzleInvestorFlowsShortRepository =>
                new DrizzleInvestorFlowsShortRepository(db as never);

            it('finra_short_volume: the same (symbol, trade date) twice is stored once', async () => {
                await clear('finra_short_volume');
                await short().upsertShortVolume([
                    {
                        symbol: 'BRK-B',
                        tradeDate: '2026-10-16',
                        shortVolume: 10,
                        totalVolume: 100,
                    },
                    {
                        symbol: 'BRK-B',
                        tradeDate: '2026-10-16',
                        shortVolume: 30,
                        totalVolume: 300,
                    },
                ]);
                expect(
                    await rows(
                        sql`SELECT short_volume::int AS short_volume, total_volume::int AS total_volume FROM finra_short_volume`
                    )
                ).toEqual([{ short_volume: 30, total_volume: 300 }]);
            });

            it('finra_short_interest: the same (symbol, settlement date) twice is stored once', async () => {
                await clear('finra_short_interest');
                await short().upsertShortInterest([
                    {
                        symbol: 'BRK-B',
                        settlementDate: '2026-09-30',
                        shortQty: 1_000,
                        prevShortQty: null,
                        avgDailyVolume: null,
                        daysToCover: null,
                    },
                    {
                        symbol: 'BRK-B',
                        settlementDate: '2026-09-30',
                        shortQty: 2_000,
                        prevShortQty: 900,
                        avgDailyVolume: 400,
                        daysToCover: 5,
                    },
                ]);
                expect(
                    await rows(
                        sql`SELECT short_qty::int AS short_qty FROM finra_short_interest`
                    )
                ).toEqual([{ short_qty: 2_000 }]);
            });
        });

        it('reg_sho_threshold (ON CONFLICT DO NOTHING) already tolerates the same listing twice', async () => {
            await clear('reg_sho_threshold');
            const listing = {
                symbol: 'BRK-B',
                tradeDate: '2026-10-16',
                market: 'NYSE',
            };
            await new DrizzleInvestorFlowsRegShoRepository(
                db as never
            ).insertListings([listing, listing]);
            expect(
                await rows(sql`SELECT symbol FROM reg_sho_threshold`)
            ).toEqual([{ symbol: 'BRK-B' }]);
        });

        it('sec_13f positions and option positions: a duplicated CUSIP in one filing is stored once', async () => {
            await clear(
                'sec_13f_positions',
                'sec_13f_option_positions',
                'sec_13f_dirty_aggregates',
                'sec_13f_filings'
            );
            await new Drizzle13fRepository(db as never).applyFiling({
                accession: '0000950123-26-000001',
                cik: '0001067983',
                filingDate: '2026-08-14',
                submissionType: '13F-HR',
                amendmentType: null,
                period: '2026-06-30',
                filerName: null,
                mode: 'merge',
                rows: [
                    { cusip: SHARED, shares: 10, valueUsd: 4_000 },
                    { cusip: SHARED, shares: 30, valueUsd: 12_000 },
                ],
                optionRows: [
                    {
                        cusip: SHARED,
                        putCall: 'put',
                        shares: 5,
                        valueUsd: 2_000,
                    },
                    {
                        cusip: SHARED,
                        putCall: 'put',
                        shares: 7,
                        valueUsd: 2_800,
                    },
                ],
                cusipIds: new Map([[SHARED, 41]]),
                universeStamp: '2026-01-01 00:00:00+00',
                firstForPeriod: false,
            });
            expect(
                await rows(
                    sql`SELECT shares::int AS shares FROM sec_13f_positions`
                )
            ).toEqual([{ shares: 30 }]);
            expect(
                await rows(
                    sql`SELECT shares::int AS shares FROM sec_13f_option_positions`
                )
            ).toEqual([{ shares: 7 }]);
        });
    }
);
