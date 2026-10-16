import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { describeTarget } from '../../../../../db/scripts/lib/dbTarget';
import * as schema from '@/shared/db/schema';
import { dartFatalReason } from '@/shared/api/dart/dartClient';
import {
    buildFakeDartData,
    createFakeDartClient,
} from '@/shared/api/dart/fakeDartClient';
import { INVESTOR_FLOWS_DART_MAX_LIST_PAGES } from '../../lib/investorFlowsPolicy';
import { DrizzleKoreanTickerRepository } from '@/entities/ticker/api';
import { DrizzleInvestorFlowsDartRepository } from '../../api/investorFlowsDartRepository';
import { runDartFilingsIngest } from '../../server/ingestDartFilings';
import type {
    DartInsiderReportRow,
    DartMajorHoldingRow,
    DartTradingPlanRow,
} from '../../model';

vi.mock('server-only', () => ({}));

/**
 * DART 저장소의 SQL을 **진짜 Postgres**에서 검증한다 — upsert 충돌 처리·numeric 왕복·보존 정리·우선주 매핑 조회는 렌더 문자열로는
 * 의미를 못 본다(TESTING.md#TE-55). `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker compose -p <name> -f docker-compose.e2e.yml up -d --pull never postgres
 *   TEST_DATABASE_URL=postgres://siglens:siglens@localhost:5433/siglens_e2e yarn test .db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 실제 마이그레이션(`korean_tickers` 생성·`delisted_at` 추가, `0048`·`0049`)을
 * 적용한 뒤 끝나면 스키마를 지운다. 상장주식수 열(`0051`)과 그 upsert(`DrizzleKoreanTickerRepository`)도 같은 테이블이라 여기서 본다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `investor_flows_dart_test_${process.pid}`;
const migration = (file: string): string =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8');
const statements = (text: string): string[] =>
    text.split('--> statement-breakpoint');

/** 첫 마이그레이션 중 `korean_tickers` 생성문만(나머지 테이블은 이 테스트와 무관하다). */
const KOREAN_TICKERS_DDL = statements(migration('0000_absent_kid_colt.sql'))
    .filter(statement => statement.includes('CREATE TABLE "korean_tickers"'))
    .concat(statements(migration('0028_lush_wendell_vaughn.sql')))
    .concat(statements(migration('0051_kr_listed_shares.sql')));
const INVESTOR_FLOWS_DDL = [
    '0048_investor_flows_data.sql',
    '0049_investor_flows_expansion.sql',
].flatMap(file => statements(migration(file)));

const SAMSUNG = '00126380';
const HANWHA = '00160843';

const major = (
    over: Partial<DartMajorHoldingRow> = {}
): DartMajorHoldingRow => ({
    rceptNo: '20260311000555',
    corpCode: SAMSUNG,
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
    corpCode: SAMSUNG,
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
    corpCode: SAMSUNG,
    receiptDate: '2026-10-14',
    reporter: '이임원',
    title: '임원ㆍ주요주주특정증권등거래계획보고서',
    ...over,
});

describe.skipIf(!URL)('DART repository on a real Postgres', () => {
    let admin: postgres.Sql;
    let client: postgres.Sql;
    let db: ReturnType<typeof drizzle<typeof schema>>;
    let repo: DrizzleInvestorFlowsDartRepository;

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
        for (const statement of [
            ...KOREAN_TICKERS_DDL,
            ...INVESTOR_FLOWS_DDL,
        ]) {
            await client.unsafe(statement);
        }
        db = drizzle(client, { schema });
        repo = new DrizzleInvestorFlowsDartRepository(db as never);
    });

    afterAll(async () => {
        await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
        await client?.end();
        await admin?.end();
    });

    beforeEach(async () => {
        for (const table of [
            'dart_corp_code',
            'dart_major_holdings',
            'dart_insider_reports',
            'dart_trading_plans',
            'investor_flows_state',
            'korean_tickers',
        ]) {
            await db.execute(sql.raw(`DELETE FROM ${table}`));
        }
    });

    describe('corp code map', () => {
        it('upserts, updates a changed corp and reads the map back', async () => {
            await repo.upsertCorpCodes([
                {
                    stockCode: '005930',
                    corpCode: SAMSUNG,
                    corpName: '삼성전자',
                },
                {
                    stockCode: '000880',
                    corpCode: '00000001',
                    corpName: '옛 한화',
                },
            ]);
            await repo.upsertCorpCodes([
                { stockCode: '000880', corpCode: HANWHA, corpName: '한화' },
            ]);
            expect(Object.fromEntries(await repo.loadCorpCodeMap())).toEqual({
                '005930': SAMSUNG,
                '000880': HANWHA,
            });
        });

        it('upserts more rows than one chunk', async () => {
            await repo.upsertCorpCodes(
                Array.from({ length: 1_234 }, (_, index) => ({
                    stockCode: String(100_000 + index),
                    corpCode: String(10_000_000 + index),
                    corpName: `회사${index}`,
                }))
            );
            expect((await repo.loadCorpCodeMap()).size).toBe(1_234);
        });

        it('resolves a common code directly and a preferred code through its common code', async () => {
            await repo.upsertCorpCodes([
                {
                    stockCode: '005930',
                    corpCode: SAMSUNG,
                    corpName: '삼성전자',
                },
                { stockCode: '000880', corpCode: HANWHA, corpName: '한화' },
            ]);
            expect(await repo.resolveCorpCode('005930')).toEqual({
                corpCode: SAMSUNG,
                corpName: '삼성전자',
                matchedStockCode: '005930',
                viaCommonShare: false,
            });
            expect(await repo.resolveCorpCode('00088K')).toEqual({
                corpCode: HANWHA,
                corpName: '한화',
                matchedStockCode: '000880',
                viaCommonShare: true,
            });
            expect(await repo.resolveCorpCode('069500')).toBeNull();
        });
    });

    it('lists only listed KR symbols from the ticker DB', async () => {
        await db.insert(schema.koreanTickers).values(
            [
                ['005930.KS', null],
                ['035720.KQ', null],
                ['000040.KS', new Date('2026-01-01T00:00:00Z')],
                ['AAPL', null],
            ].map(([symbol, delistedAt]) => ({
                symbol: symbol as string,
                koreanName: '이름',
                name: 'Name',
                exchange: 'KSC',
                exchangeFullName: 'KSE',
                delistedAt: delistedAt as Date | null,
            }))
        );
        expect(await repo.listKrSymbols()).toEqual(['005930.KS', '035720.KQ']);
    });

    describe('major holdings', () => {
        it('round-trips ratios as numbers and overwrites a re-fetched row', async () => {
            await repo.upsertMajorHoldings([
                major(),
                major({
                    rceptNo: '20260105000101',
                    receiptDate: '2026-01-05',
                    reporter: 'BlackRock',
                    reportForm: 'abbreviated',
                    ratioPct: 5.03,
                    ratioChangePct: null,
                    shares: null,
                    reason: null,
                }),
            ]);
            await repo.upsertMajorHoldings([major({ ratioPct: 7.25 })]);
            expect(await repo.findMajorHoldings(SAMSUNG, '2026-01-01')).toEqual(
                [
                    {
                        rceptNo: '20260311000555',
                        receiptDate: '2026-03-11',
                        reporter: '국민연금공단',
                        reportForm: 'detailed',
                        shares: 432_154_213,
                        sharesChange: -25_165_617,
                        ratioPct: 7.25,
                        ratioChangePct: -0.36,
                        reason: '보유주식등의 수 변동',
                    },
                    {
                        rceptNo: '20260105000101',
                        receiptDate: '2026-01-05',
                        reporter: 'BlackRock',
                        reportForm: 'abbreviated',
                        shares: null,
                        sharesChange: -25_165_617,
                        ratioPct: 5.03,
                        ratioChangePct: null,
                        reason: null,
                    },
                ]
            );
        });

        it('keeps two reporters of one receipt as two rows and filters by corp and date', async () => {
            await repo.upsertMajorHoldings([
                major(),
                major({ reporter: '공동보유자' }),
                major({ rceptNo: '20250101000001', receiptDate: '2025-01-01' }),
                major({ rceptNo: '20260311000999', corpCode: HANWHA }),
            ]);
            const rows = await repo.findMajorHoldings(SAMSUNG, '2026-01-01');
            expect(rows.map(row => row.reporter).toSorted()).toEqual([
                '공동보유자',
                '국민연금공단',
            ]);
        });
    });

    it('insider reports keep the registration flag, relation text and nulls', async () => {
        await repo.upsertInsiderReports([
            insider(),
            insider({
                rceptNo: '20260915000222',
                receiptDate: '2026-09-15',
                reporter: '삼성생명보험',
                position: null,
                registered: null,
                majorShareholder: '10%이상주주',
                ratioPct: 8.51,
            }),
        ]);
        await repo.upsertInsiderReports([insider({ registered: false })]);
        expect(await repo.findInsiderReports(SAMSUNG, '2026-09-01')).toEqual([
            {
                rceptNo: '20261002000321',
                receiptDate: '2026-10-02',
                reporter: '홍길동',
                position: '사내이사',
                registered: false,
                majorShareholder: null,
                shares: 12_000,
                sharesChange: 2_000,
                ratioPct: 0.0123,
                ratioChangePct: null,
            },
            {
                rceptNo: '20260915000222',
                receiptDate: '2026-09-15',
                reporter: '삼성생명보험',
                position: null,
                registered: null,
                majorShareholder: '10%이상주주',
                shares: 12_000,
                sharesChange: 2_000,
                ratioPct: 8.51,
                ratioChangePct: null,
            },
        ]);
    });

    it('trading plans upsert by receipt number', async () => {
        await repo.upsertTradingPlans([
            plan(),
            plan({ rceptNo: '20261001000001', receiptDate: '2026-10-01' }),
        ]);
        await repo.upsertTradingPlans([
            plan({ title: '[기재정정]임원ㆍ주요주주특정증권등거래계획보고서' }),
        ]);
        expect(await repo.findTradingPlans(SAMSUNG, '2026-10-01')).toEqual([
            {
                rceptNo: '20261014000789',
                receiptDate: '2026-10-14',
                reporter: '이임원',
                title: '[기재정정]임원ㆍ주요주주특정증권등거래계획보고서',
            },
            {
                rceptNo: '20261001000001',
                receiptDate: '2026-10-01',
                reporter: '이임원',
                title: '임원ㆍ주요주주특정증권등거래계획보고서',
            },
        ]);
    });

    it('prunes all three tables below the cutoff and counts the deleted rows', async () => {
        await repo.upsertMajorHoldings([
            major(),
            major({ rceptNo: '20240101000001', receiptDate: '2024-01-01' }),
        ]);
        await repo.upsertInsiderReports([
            insider({ rceptNo: '20240101000002', receiptDate: '2024-01-01' }),
        ]);
        await repo.upsertTradingPlans([
            plan({ rceptNo: '20240101000003', receiptDate: '2024-01-01' }),
            plan(),
        ]);
        expect(await repo.pruneBefore('2024-10-16')).toBe(3);
        expect(
            await repo.findMajorHoldings(SAMSUNG, '2000-01-01')
        ).toHaveLength(1);
        expect(await repo.findInsiderReports(SAMSUNG, '2000-01-01')).toEqual(
            []
        );
        expect(await repo.findTradingPlans(SAMSUNG, '2000-01-01')).toHaveLength(
            1
        );
    });

    it('pipeline: the fake DART client through the real repository stores rows for common and preferred symbols', async () => {
        await repo.upsertCorpCodes([
            { stockCode: '005930', corpCode: SAMSUNG, corpName: '삼성전자' },
            { stockCode: '000880', corpCode: HANWHA, corpName: '한화' },
        ]);
        await db.insert(schema.koreanTickers).values(
            ['005930.KS', '005935.KS', '00088K.KS'].map(symbol => ({
                symbol,
                koreanName: '이름',
                name: 'Name',
                exchange: 'KSC',
                exchangeFullName: 'KSE',
            }))
        );
        const invalidated: string[] = [];
        const result = await runDartFilingsIngest({
            dart: createFakeDartClient(undefined, {
                now: () => new Date('2026-10-16T01:00:00Z'),
            }),
            repo,
            fatalReason: dartFatalReason,
            now: () => new Date('2026-10-16T01:00:00Z'),
            isDeadlineReached: () => false,
            invalidateSymbols: symbols => {
                invalidated.push(...symbols);
            },
            log: () => {},
        });
        expect(result).toMatchObject({
            status: 'complete',
            backfillDone: true,
            majorRowsStored: 2,
            insiderRowsStored: 3,
            tradingPlansStored: 1,
        });
        expect(
            await repo.findMajorHoldings(SAMSUNG, '2026-01-01')
        ).toHaveLength(2);
        expect(
            await repo.findInsiderReports(SAMSUNG, '2026-01-01')
        ).toHaveLength(2);
        expect(
            await repo.findInsiderReports(HANWHA, '2026-01-01')
        ).toHaveLength(1);
        expect(await repo.findTradingPlans(SAMSUNG, '2026-01-01')).toHaveLength(
            1
        );
        expect(invalidated).toEqual(['00088K.KS', '005930.KS', '005935.KS']);
        expect(await repo.getState('dart_backfill_done')).toBe('2026-10-16');
    });

    it('pipeline: drops rows of another report type and keeps the D005 resume date in the stored cursor on overflow', async () => {
        const now = new Date('2026-10-16T01:00:00Z');
        await repo.upsertCorpCodes([
            { stockCode: '005930', corpCode: SAMSUNG, corpName: '삼성전자' },
        ]);
        await db.insert(schema.koreanTickers).values({
            symbol: '005930.KS',
            koreanName: '이름',
            name: 'Name',
            exchange: 'KSC',
            exchangeFullName: 'KSE',
        });
        const base = buildFakeDartData(now);
        const plansWithStray = [
            ...(base.disclosures.D005 ?? []),
            // A D002 title under D005 — what an ignored detail filter returns.
            {
                ...(base.disclosures.D005 ?? [])[0],
                rcept_no: '20261014000999',
                report_nm: '임원ㆍ주요주주특정증권등소유상황보고서',
            },
        ];
        const fake = createFakeDartClient({
            ...base,
            disclosures: { ...base.disclosures, D005: plansWithStray },
        });
        const result = await runDartFilingsIngest({
            dart: {
                ...fake,
                fetchDisclosureList: async query => {
                    const page = await fake.fetchDisclosureList(query);
                    return query.detailType === 'D005'
                        ? {
                              ...page,
                              totalPage: INVESTOR_FLOWS_DART_MAX_LIST_PAGES + 1,
                          }
                        : page;
                },
            },
            repo,
            fatalReason: dartFatalReason,
            now: () => now,
            isDeadlineReached: () => false,
            invalidateSymbols: () => {},
            log: () => {},
        });
        expect(result).toMatchObject({
            status: 'complete',
            listComplete: false,
            tradingPlansStored: 1,
            mismatchedRows: 1,
        });
        expect(
            (await repo.findTradingPlans(SAMSUNG, '2026-01-01')).map(
                row => row.rceptNo
            )
        ).toEqual([String((base.disclosures.D005 ?? [])[0]?.rcept_no)]);
        const cursor: unknown = JSON.parse(
            (await repo.getState('dart_list_cursor')) ?? 'null'
        );
        expect(cursor).toMatchObject({
            through: '2026-10-16',
            tradingPlansFrom: '2026-10-14',
        });
    });

    describe('listed shares', () => {
        const ticker = {
            symbol: '005930.KS',
            koreanName: '삼성전자',
            name: '삼성전자',
            exchange: 'KOSPI',
            exchangeFullName: 'Korea Exchange (KOSPI)',
        };

        it('reads the listed share count of a listed KR row and keeps it when a later upsert has none', async () => {
            const tickers = new DrizzleKoreanTickerRepository(db as never);
            await tickers.upsertMany([
                { ...ticker, listedShares: 5_919_637_922 },
            ]);
            expect(await repo.findListedShares('005930')).toBe(5_919_637_922);
            // The translation path upserts without the field; a sync day without the supplement passes null.
            await tickers.upsertMany([ticker]);
            await tickers.upsertMany([{ ...ticker, listedShares: null }]);
            expect(await repo.findListedShares('005930')).toBe(5_919_637_922);
            await tickers.upsertMany([
                { ...ticker, listedShares: 5_969_782_550 },
            ]);
            expect(await repo.findListedShares('005930')).toBe(5_969_782_550);
        });

        it('is null for an unknown count, a delisted row and a missing code', async () => {
            await db.insert(schema.koreanTickers).values([
                { ...ticker, symbol: '000660.KS' },
                {
                    ...ticker,
                    symbol: '035720.KS',
                    listedShares: 441_000_000,
                    delistedAt: new Date('2026-10-01T00:00:00Z'),
                },
            ]);
            expect(await repo.findListedShares('000660')).toBeNull();
            expect(await repo.findListedShares('035720')).toBeNull();
            expect(await repo.findListedShares('999990')).toBeNull();
        });
    });

    it('state: overwrites the cursor and keeps a set-once marker', async () => {
        await repo.setState('dart_list_cursor', '{"through":"2026-10-15"}');
        await repo.setState('dart_list_cursor', '{"through":"2026-10-16"}');
        await repo.setStateIfAbsent('dart_backfill_done', '2026-10-16');
        await repo.setStateIfAbsent('dart_backfill_done', '2026-10-20');
        expect(await repo.getState('dart_list_cursor')).toBe(
            '{"through":"2026-10-16"}'
        );
        expect(await repo.getState('dart_backfill_done')).toBe('2026-10-16');
    });
});
