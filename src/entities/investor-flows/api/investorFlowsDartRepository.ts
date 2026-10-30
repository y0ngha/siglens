import 'server-only';
import {
    and,
    desc,
    eq,
    gte,
    inArray,
    isNotNull,
    isNull,
    like,
    or,
    sql,
} from 'drizzle-orm';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import {
    dartCorpCode,
    dartInsiderReports,
    dartMajorHoldings,
    dartTradingPlans,
    investorFlowsState,
    koreanTickers,
} from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { KR_SYMBOL_LIKE_PATTERNS } from '@/entities/ticker/api';
import { commonShareCandidates, resolveDartCorp } from '../lib/dartSymbol';
import { chunked } from '../lib/chunked';
import { compositeKey } from '../lib/dedupeByKey';
import { INVESTOR_FLOWS_UPSERT_CHUNK_SIZE } from '../lib/investorFlowsPolicy';
import type {
    DartCorpCodeRow,
    DartCorpRecord,
    DartInsiderReportRow,
    DartMajorHoldingRow,
    DartTradingPlanRow,
} from '../model';
import { affectedRows } from './affectedRows';
import { warnWithDetail } from '@/shared/lib/warnWithDetail';
import { type UpsertLog, uniqueForUpsert } from './uniqueForUpsert';
import {
    readInvestorFlowsState,
    writeInvestorFlowsState,
} from './investorFlowsState';

/** 비율(`numeric`) 쓰기 — postgres-js는 numeric을 문자열로 주고받는다. */
const toNumeric = (value: number | null): string | null =>
    value === null ? null : String(value);
/** 비율 읽기. 숫자로 읽히지 않으면 null. */
const fromNumeric = (value: string | null): number | null => {
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

/**
 * `rows`를 `INVESTOR_FLOWS_UPSERT_CHUNK_SIZE`씩 잘라 **차례로** 쓴다 — 한 문장의 바인드 파라미터를 묶고, 청크끼리 DB 연결을
 * 다투지 않게 한다.
 */
async function writeInChunks<T>(
    rows: readonly T[],
    write: (chunk: T[]) => Promise<unknown>
): Promise<void> {
    await chunked(rows, INVESTOR_FLOWS_UPSERT_CHUNK_SIZE).reduce<
        Promise<unknown>
    >(
        (previous, chunk) => previous.then(() => write(chunk)),
        Promise.resolve()
    );
}

/** 저장된 대량보유 보고 한 건(읽기). */
export type DartMajorHoldingRecord = Omit<DartMajorHoldingRow, 'corpCode'>;
/** 저장된 임원·주요주주 소유보고 한 건(읽기). */
export type DartInsiderReportRecord = Omit<DartInsiderReportRow, 'corpCode'>;
/** 저장된 거래계획보고서 한 건(읽기). */
export type DartTradingPlanRecord = Omit<DartTradingPlanRow, 'corpCode'>;

/**
 * 한국 DART 지분공시 저장소(설계 §4.2) — `dart_corp_code`·`dart_major_holdings`·`dart_insider_reports`·`dart_trading_plans`와
 * 수집 상태(`investor_flows_state`). 화면·도구는 이 테이블만 읽고 DART를 직접 부르지 않는다(봇 크롤·공개 API가 할당량을 쓰지
 * 않게). 읽기 함수(`find*`·`resolveCorpCode`)는 한국 수급 스냅샷(`loadKrInvestorFlowsSnapshot`)과 종목 매핑 조회(`getKrDartCorp`)가 쓴다.
 */
export class DrizzleInvestorFlowsDartRepository {
    constructor(
        private readonly db: SiglensDatabase,
        /** 중복 키를 줄였을 때의 경고(`uniqueForUpsert`) — 수집 cron은 자기 `log`를 넘긴다. */
        private readonly log: UpsertLog = warnWithDetail
    ) {}

    getState(key: string): Promise<string | null> {
        return readInvestorFlowsState(this.db, key);
    }

    setState(key: string, value: string): Promise<void> {
        return writeInvestorFlowsState(this.db, key, value);
    }

    /** 키가 없을 때만 기록한다(set-once 표식). */
    async setStateIfAbsent(key: string, value: string): Promise<void> {
        await withRetry(
            () =>
                this.db
                    .insert(investorFlowsState)
                    .values({ key, value })
                    .onConflictDoNothing({ target: investorFlowsState.key }),
            DB_TRANSIENT_RETRY
        );
    }

    /** 상장 중인 한국 종목 심볼(`.KS`·`.KQ`) — DART 유니버스의 출발점. */
    async listKrSymbols(): Promise<string[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({ symbol: koreanTickers.symbol })
                    .from(koreanTickers)
                    .where(
                        and(
                            isNull(koreanTickers.delistedAt),
                            or(
                                ...KR_SYMBOL_LIKE_PATTERNS.map(pattern =>
                                    like(koreanTickers.symbol, pattern)
                                )
                            )
                        )
                    )
                    .orderBy(koreanTickers.symbol),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => row.symbol);
    }

    /** `dart_corp_code` 전체 — 종목코드 → 고유번호(상장사 ≈3천 행). */
    async loadCorpCodeMap(): Promise<Map<string, string>> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        stockCode: dartCorpCode.stockCode,
                        corpCode: dartCorpCode.corpCode,
                    })
                    .from(dartCorpCode),
            DB_TRANSIENT_RETRY
        );
        return new Map(rows.map(row => [row.stockCode, row.corpCode]));
    }

    /** 고유번호 맵 반영 — 바뀐 행만 갱신한다(`IS DISTINCT FROM`). 맵에서 사라진 종목코드는 지우지 않는다(상폐 종목 링크 유지). */
    async upsertCorpCodes(rows: readonly DartCorpCodeRow[]): Promise<void> {
        const unique = uniqueForUpsert(
            'dart_corp_code',
            rows,
            row => row.stockCode,
            this.log
        );
        await writeInChunks(unique, chunk =>
            withRetry(
                () =>
                    this.db
                        .insert(dartCorpCode)
                        .values(chunk.map(row => ({ ...row })))
                        .onConflictDoUpdate({
                            target: dartCorpCode.stockCode,
                            set: {
                                corpCode: sql`excluded.corp_code`,
                                corpName: sql`excluded.corp_name`,
                                updatedAt: sql`now()`,
                            },
                            setWhere: sql`${dartCorpCode.corpCode} IS DISTINCT FROM excluded.corp_code OR ${dartCorpCode.corpName} IS DISTINCT FROM excluded.corp_name`,
                        }),
                DB_TRANSIENT_RETRY
            )
        );
    }

    /** 대량보유 보고 upsert(기본키 접수번호·보고자). 정정·재조회로 같은 행이 오면 값을 덮는다. */
    async upsertMajorHoldings(
        rows: readonly DartMajorHoldingRow[]
    ): Promise<void> {
        const unique = uniqueForUpsert(
            'dart_major_holdings',
            rows,
            row => compositeKey(row.rceptNo, row.reporter),
            this.log
        );
        await writeInChunks(unique, chunk =>
            withRetry(
                () =>
                    this.db
                        .insert(dartMajorHoldings)
                        .values(
                            chunk.map(row => ({
                                ...row,
                                ratioPct: toNumeric(row.ratioPct),
                                ratioChangePct: toNumeric(row.ratioChangePct),
                            }))
                        )
                        .onConflictDoUpdate({
                            target: [
                                dartMajorHoldings.rceptNo,
                                dartMajorHoldings.reporter,
                            ],
                            set: {
                                corpCode: sql`excluded.corp_code`,
                                receiptDate: sql`excluded.receipt_date`,
                                reportForm: sql`excluded.report_form`,
                                shares: sql`excluded.shares`,
                                sharesChange: sql`excluded.shares_change`,
                                ratioPct: sql`excluded.ratio_pct`,
                                ratioChangePct: sql`excluded.ratio_change_pct`,
                                reason: sql`excluded.reason`,
                            },
                        }),
                DB_TRANSIENT_RETRY
            )
        );
    }

    /** 임원·주요주주 소유보고 upsert(기본키 접수번호·보고자). */
    async upsertInsiderReports(
        rows: readonly DartInsiderReportRow[]
    ): Promise<void> {
        const unique = uniqueForUpsert(
            'dart_insider_reports',
            rows,
            row => compositeKey(row.rceptNo, row.reporter),
            this.log
        );
        await writeInChunks(unique, chunk =>
            withRetry(
                () =>
                    this.db
                        .insert(dartInsiderReports)
                        .values(
                            chunk.map(row => ({
                                ...row,
                                ratioPct: toNumeric(row.ratioPct),
                                ratioChangePct: toNumeric(row.ratioChangePct),
                            }))
                        )
                        .onConflictDoUpdate({
                            target: [
                                dartInsiderReports.rceptNo,
                                dartInsiderReports.reporter,
                            ],
                            set: {
                                corpCode: sql`excluded.corp_code`,
                                receiptDate: sql`excluded.receipt_date`,
                                position: sql`excluded.position`,
                                registered: sql`excluded.registered`,
                                majorShareholder: sql`excluded.major_shareholder`,
                                shares: sql`excluded.shares`,
                                sharesChange: sql`excluded.shares_change`,
                                ratioPct: sql`excluded.ratio_pct`,
                                ratioChangePct: sql`excluded.ratio_change_pct`,
                            },
                        }),
                DB_TRANSIENT_RETRY
            )
        );
    }

    /** 거래계획보고서 upsert(기본키 접수번호). */
    async upsertTradingPlans(
        rows: readonly DartTradingPlanRow[]
    ): Promise<void> {
        // 공시검색 페이지끼리 같은 접수번호가 겹칠 수 있다(목록이 읽는 사이 바뀌면) — 생산자가 지우지 않는 유일한 DART 경로다.
        const unique = uniqueForUpsert(
            'dart_trading_plans',
            rows,
            row => row.rceptNo,
            this.log
        );
        await writeInChunks(unique, chunk =>
            withRetry(
                () =>
                    this.db
                        .insert(dartTradingPlans)
                        .values(chunk.map(row => ({ ...row })))
                        .onConflictDoUpdate({
                            target: dartTradingPlans.rceptNo,
                            set: {
                                corpCode: sql`excluded.corp_code`,
                                receiptDate: sql`excluded.receipt_date`,
                                reporter: sql`excluded.reporter`,
                                title: sql`excluded.title`,
                            },
                        }),
                DB_TRANSIENT_RETRY
            )
        );
    }

    /** 보존 정리 — 세 공시 테이블에서 접수일이 `cutoffDate`보다 이른 행을 지운다. 지운 행 수 합계. */
    async pruneBefore(cutoffDate: string): Promise<number> {
        const [major, insider, plans] = await Promise.all(
            [
                sql`DELETE FROM dart_major_holdings WHERE receipt_date < ${cutoffDate}::date`,
                sql`DELETE FROM dart_insider_reports WHERE receipt_date < ${cutoffDate}::date`,
                sql`DELETE FROM dart_trading_plans WHERE receipt_date < ${cutoffDate}::date`,
            ].map(async statement =>
                affectedRows(
                    await withRetry(
                        () => this.db.execute(statement),
                        DB_TRANSIENT_RETRY
                    )
                )
            )
        );
        return (major ?? 0) + (insider ?? 0) + (plans ?? 0);
    }

    // ── 읽기(한국 수급 탭 스냅샷·매핑 조회) ──────────────────────────────────────────────────────────

    /**
     * 단축코드(`005930`, 우선주 `005935`) → 고유번호. 우선주는 끝자리를 `0`으로 바꾼 보통주 코드로 찾는다(`dartSymbol.ts`).
     * 없으면 null(화면은 DART 섹션 "데이터 없음").
     */
    async resolveCorpCode(stockCode: string): Promise<DartCorpRecord | null> {
        const candidates = commonShareCandidates(stockCode);
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        stockCode: dartCorpCode.stockCode,
                        corpCode: dartCorpCode.corpCode,
                        corpName: dartCorpCode.corpName,
                    })
                    .from(dartCorpCode)
                    .where(inArray(dartCorpCode.stockCode, candidates)),
            DB_TRANSIENT_RETRY
        );
        const match = resolveDartCorp(
            stockCode,
            new Map(rows.map(row => [row.stockCode, row.corpCode]))
        );
        const corpName = rows.find(
            row => row.stockCode === match?.matchedStockCode
        )?.corpName;
        return match === null || corpName === undefined
            ? null
            : { ...match, corpName };
    }

    /**
     * 단축코드의 상장주식수(`korean_tickers.listed_shares`, `kr-tickers` cron이 주식시세 V2에서 채운다). 상장 중인 `.KS`·`.KQ`
     * 행에 값이 있을 때만 숫자, 아니면 null(발행주식수 모름 — core는 비율을 쓰지 않는다).
     */
    async findListedShares(stockCode: string): Promise<number | null> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({ listedShares: koreanTickers.listedShares })
                    .from(koreanTickers)
                    .where(
                        and(
                            inArray(
                                koreanTickers.symbol,
                                KR_SYMBOL_LIKE_PATTERNS.map(pattern =>
                                    pattern.replace('%', stockCode)
                                )
                            ),
                            isNull(koreanTickers.delistedAt),
                            isNotNull(koreanTickers.listedShares)
                        )
                    )
                    .limit(1),
            DB_TRANSIENT_RETRY
        );
        return rows[0]?.listedShares ?? null;
    }

    /** 회사의 대량보유 보고(`sinceDate` 이후 접수, 최근 순). */
    async findMajorHoldings(
        corpCode: string,
        sinceDate: string
    ): Promise<DartMajorHoldingRecord[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        rceptNo: dartMajorHoldings.rceptNo,
                        receiptDate: dartMajorHoldings.receiptDate,
                        reporter: dartMajorHoldings.reporter,
                        reportForm: dartMajorHoldings.reportForm,
                        shares: dartMajorHoldings.shares,
                        sharesChange: dartMajorHoldings.sharesChange,
                        ratioPct: dartMajorHoldings.ratioPct,
                        ratioChangePct: dartMajorHoldings.ratioChangePct,
                        reason: dartMajorHoldings.reason,
                    })
                    .from(dartMajorHoldings)
                    .where(
                        and(
                            eq(dartMajorHoldings.corpCode, corpCode),
                            gte(dartMajorHoldings.receiptDate, sinceDate)
                        )
                    )
                    .orderBy(
                        desc(dartMajorHoldings.receiptDate),
                        desc(dartMajorHoldings.rceptNo),
                        dartMajorHoldings.reporter
                    ),
            DB_TRANSIENT_RETRY
        );
        return rows.flatMap(row =>
            row.reportForm === 'detailed' || row.reportForm === 'abbreviated'
                ? [
                      {
                          ...row,
                          reportForm: row.reportForm,
                          ratioPct: fromNumeric(row.ratioPct),
                          ratioChangePct: fromNumeric(row.ratioChangePct),
                      },
                  ]
                : []
        );
    }

    /** 회사의 임원·주요주주 소유보고(`sinceDate` 이후 접수, 최근 순). */
    async findInsiderReports(
        corpCode: string,
        sinceDate: string
    ): Promise<DartInsiderReportRecord[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        rceptNo: dartInsiderReports.rceptNo,
                        receiptDate: dartInsiderReports.receiptDate,
                        reporter: dartInsiderReports.reporter,
                        position: dartInsiderReports.position,
                        registered: dartInsiderReports.registered,
                        majorShareholder: dartInsiderReports.majorShareholder,
                        shares: dartInsiderReports.shares,
                        sharesChange: dartInsiderReports.sharesChange,
                        ratioPct: dartInsiderReports.ratioPct,
                        ratioChangePct: dartInsiderReports.ratioChangePct,
                    })
                    .from(dartInsiderReports)
                    .where(
                        and(
                            eq(dartInsiderReports.corpCode, corpCode),
                            gte(dartInsiderReports.receiptDate, sinceDate)
                        )
                    )
                    .orderBy(
                        desc(dartInsiderReports.receiptDate),
                        desc(dartInsiderReports.rceptNo),
                        dartInsiderReports.reporter
                    ),
            DB_TRANSIENT_RETRY
        );
        return rows.map(row => ({
            ...row,
            ratioPct: fromNumeric(row.ratioPct),
            ratioChangePct: fromNumeric(row.ratioChangePct),
        }));
    }

    /** 회사의 거래계획보고서(`sinceDate` 이후 접수, 최근 순). */
    async findTradingPlans(
        corpCode: string,
        sinceDate: string
    ): Promise<DartTradingPlanRecord[]> {
        return withRetry(
            () =>
                this.db
                    .select({
                        rceptNo: dartTradingPlans.rceptNo,
                        receiptDate: dartTradingPlans.receiptDate,
                        reporter: dartTradingPlans.reporter,
                        title: dartTradingPlans.title,
                    })
                    .from(dartTradingPlans)
                    .where(
                        and(
                            eq(dartTradingPlans.corpCode, corpCode),
                            gte(dartTradingPlans.receiptDate, sinceDate)
                        )
                    )
                    .orderBy(
                        desc(dartTradingPlans.receiptDate),
                        desc(dartTradingPlans.rceptNo)
                    ),
            DB_TRANSIENT_RETRY
        );
    }
}
