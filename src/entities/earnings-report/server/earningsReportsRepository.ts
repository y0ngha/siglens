import {
    and,
    asc,
    desc,
    eq,
    gte,
    isNotNull,
    isNull,
    notInArray,
    or,
    sql,
} from 'drizzle-orm';
import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import type { EarningsReportComparisonItem } from '@/shared/lib/types';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { earningsReports } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { withRetry } from '@/shared/lib/withRetry';
import { toComparisonItems } from '../lib/earningsComparison';
import {
    dateConfirmedFromPayload,
    toCalendarItem,
    toNumberOrNull,
} from '../lib/earningsRowMapping';
import {
    dedupeEarningsReportInputs,
    upcomingUnreportedDates,
} from '../lib/earningsUpsertInputs';
import type { EarningsReportUpsertInput, NextEarningsSchedule } from '../model';

/**
 * `earnings_reports` 테이블 접근. 뉴스 페이지 갱신(`newsData`)과 이 entity의 분석 경로
 * (`api.ts`)가 공유한다. 일시적 DB 오류 재시도는 쓰기(upsert/prune)에만 건다 — 읽기는
 * 호출자가 degrade를 정한다.
 */
export class DrizzleEarningsReportsRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** 같은 키 중복을 걸러낸 뒤 한 문장으로 upsert하고, 충돌 시 값 컬럼과 `fetched_at`을 갱신한다. */
    async upsertMany(reports: EarningsReportUpsertInput[]): Promise<void> {
        const uniqueReports = dedupeEarningsReportInputs(reports);
        if (uniqueReports.length === 0) return;

        await withRetry(
            () =>
                this.db
                    .insert(earningsReports)
                    .values(uniqueReports.map(toInsertRow))
                    .onConflictDoUpdate({
                        target: [
                            earningsReports.symbol,
                            earningsReports.earningsDate,
                        ],
                        set: {
                            epsActual: sql`excluded.eps_actual`,
                            epsEstimated: sql`excluded.eps_estimated`,
                            revenueActual: sql`excluded.revenue_actual`,
                            revenueEstimated: sql`excluded.revenue_estimated`,
                            lastUpdated: sql`excluded.last_updated`,
                            rawPayload: sql`excluded.raw_payload`,
                            fetchedAt: sql`excluded.fetched_at`,
                        },
                    }),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * 최신 응답이 새 예정일을 줬을 때, 그 응답에 없는 `symbol`의 미래 미발표 행을 지운다.
     *
     * `(symbol, earnings_date)` 키 upsert는 행을 지우지 않으므로, 회사가 예정일을 옮기면
     * (COP: 10-29 → 11-05) 옛 행이 남고 날짜 오름차순 조회가 그 옛 날짜를 골랐다.
     * 실적이 채워진 행과 `fromDate` 이전 행은 건드리지 않는다. 응답에 새 예정일이 없으면
     * (`upcomingUnreportedDates`가 빔) 지우지 않는다 — 대체할 일정 없이 지우면 일시적인
     * 프로바이더 누락에 예정일을 통째로 잃는다.
     */
    async pruneSupersededUpcoming(
        symbol: string,
        reports: readonly EarningsReportUpsertInput[],
        fromDate: string
    ): Promise<void> {
        if (upcomingUnreportedDates(reports, fromDate).length === 0) return;
        const keepDates = reports.map(r => r.earningsDate);

        await withRetry(
            () =>
                this.db
                    .delete(earningsReports)
                    .where(
                        and(
                            eq(earningsReports.symbol, symbol),
                            gte(earningsReports.earningsDate, fromDate),
                            isNull(earningsReports.epsActual),
                            isNull(earningsReports.revenueActual),
                            notInArray(earningsReports.earningsDate, keepDates)
                        )
                    ),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * Next upcoming (or same-day) earnings entry for `symbol` on/after `fromDate` (ISO date) where no actual
     * values have been reported yet; `null` when none — **분석 경로 전용**(`getNextEarningsReport`).
     *
     * ⚠️ 프로바이더가 **추정일**이라고 표시한 일정(`dateConfirmed === false`, yahoo `isEarningsDateEstimate`)은
     * `null`로 뺀다. core에 넘기는 `EarningsCalendarItem`에는 확정 여부를 실을 자리가 없어서, 그대로 넘기면
     * 분석·뉴스 프롬프트가 yahoo 추정일을 확정된 실적일처럼 쓴다("N일 뒤 실적 발표"). 일정이 없는 것으로
     * 두는 쪽이 틀린 확정보다 낫다. 확정 여부를 모르는 행(FMP, `null`)은 지금까지처럼 넘긴다 — 미국 종목의
     * 실적일은 전부 이 경우라 빼면 분석에서 실적 맥락이 통째로 사라진다. 에이전트 도구는 확정 여부를 함께
     * 말할 수 있으므로 {@link getNextScheduleForSymbol}로 추정일까지 받는다.
     */
    async getNextForSymbol(
        symbol: string,
        fromDate: string
    ): Promise<EarningsCalendarItem | null> {
        const schedule = await this.getNextScheduleForSymbol(symbol, fromDate);
        if (schedule === null || schedule.dateConfirmed === false) return null;
        return toCalendarItem(schedule);
    }

    /**
     * {@link getNextForSymbol}과 같은 행에 확정 여부(`rawPayload`)를 붙여 돌려준다.
     *
     * 미래 미발표 행이 여럿이면 **가장 최근에 받아 온 일정**을 고른다(`fetched_at` 내림차순,
     * 같은 갱신이면 이른 날짜). upsert가 응답에 든 행의 `fetched_at`을 갱신하므로, 옛
     * `fetched_at`을 가진 미래 행은 최신 응답에 없던 옛 예정일이다 — 정리
     * (`pruneSupersededUpcoming`)가 아직 안 된 행이 있어도 옛 날짜를 고르지 않는다.
     *
     * `lastUpdated`가 없는 행(yahoo 예정 행은 늘 `null`)은 받아 온 날짜로 채운다. 예전에는
     * 이 경우 `null`을 돌려줘 KR 종목의 다음 실적일이 한 번도 나가지 않았다.
     */
    async getNextScheduleForSymbol(
        symbol: string,
        fromDate: string
    ): Promise<NextEarningsSchedule | null> {
        const [row] = await this.db
            .select({
                symbol: earningsReports.symbol,
                earningsDate: earningsReports.earningsDate,
                epsActual: earningsReports.epsActual,
                epsEstimated: earningsReports.epsEstimated,
                revenueActual: earningsReports.revenueActual,
                revenueEstimated: earningsReports.revenueEstimated,
                lastUpdated: earningsReports.lastUpdated,
                rawPayload: earningsReports.rawPayload,
                fetchedAt: earningsReports.fetchedAt,
            })
            .from(earningsReports)
            .where(
                and(
                    eq(earningsReports.symbol, symbol),
                    gte(earningsReports.earningsDate, fromDate),
                    isNull(earningsReports.epsActual),
                    isNull(earningsReports.revenueActual)
                )
            )
            .orderBy(
                desc(earningsReports.fetchedAt),
                asc(earningsReports.earningsDate)
            )
            .limit(1);

        if (row === undefined) return null;

        return {
            symbol: row.symbol,
            earningsDate: row.earningsDate,
            epsActual: null,
            epsEstimated: toNumberOrNull(row.epsEstimated),
            revenueActual: null,
            revenueEstimated: toNumberOrNull(row.revenueEstimated),
            lastUpdated: row.lastUpdated ?? kstDateKey(row.fetchedAt),
            dateConfirmed: dateConfirmedFromPayload(row.rawPayload),
        };
    }

    /** `fromDate`(ISO date) 이후 `symbol`의 실적 발표일(과거·예정 모두), 오름차순. */
    async listDatesSince(symbol: string, fromDate: string): Promise<string[]> {
        const rows = await this.db
            .select({ earningsDate: earningsReports.earningsDate })
            .from(earningsReports)
            .where(
                and(
                    eq(earningsReports.symbol, symbol),
                    gte(earningsReports.earningsDate, fromDate)
                )
            )
            .orderBy(asc(earningsReports.earningsDate));

        return rows.map(row => row.earningsDate);
    }

    /**
     * `fromDate`(ISO date) 이후 실적치(EPS 또는 매출)가 들어온 — 실제로 발표된 — 실적일,
     * 오름차순. 예정일이 옮겨져 실적치 없이 남은 옛 행은 빠진다(그 날짜에는 발표가 없었다).
     */
    async listReportedDatesSince(
        symbol: string,
        fromDate: string
    ): Promise<string[]> {
        const rows = await this.db
            .select({ earningsDate: earningsReports.earningsDate })
            .from(earningsReports)
            .where(
                and(
                    eq(earningsReports.symbol, symbol),
                    gte(earningsReports.earningsDate, fromDate),
                    or(
                        isNotNull(earningsReports.epsActual),
                        isNotNull(earningsReports.revenueActual)
                    )
                )
            )
            .orderBy(asc(earningsReports.earningsDate));

        return rows.map(row => row.earningsDate);
    }

    /** `symbol`의 가장 최근 `fetched_at`. 행이 없으면 `null` — 24h 신선도 게이트의 입력이다. */
    async getLatestFetchedAt(symbol: string): Promise<Date | null> {
        const [row] = await this.db
            .select({ fetchedAt: earningsReports.fetchedAt })
            .from(earningsReports)
            .where(eq(earningsReports.symbol, symbol))
            .orderBy(desc(earningsReports.fetchedAt))
            .limit(1);

        return row?.fetchedAt ?? null;
    }

    /** 뉴스 페이지 비교 카드 항목(`today`는 KST `YYYY-MM-DD`). 슬롯 배정은 `toComparisonItems`가 한다. */
    async getComparisonItems(
        symbol: string,
        today: string
    ): Promise<EarningsReportComparisonItem[]> {
        const rows = await this.db
            .select({
                symbol: earningsReports.symbol,
                earningsDate: earningsReports.earningsDate,
                epsActual: earningsReports.epsActual,
                epsEstimated: earningsReports.epsEstimated,
                revenueActual: earningsReports.revenueActual,
                revenueEstimated: earningsReports.revenueEstimated,
                lastUpdated: earningsReports.lastUpdated,
            })
            .from(earningsReports)
            .where(eq(earningsReports.symbol, symbol));

        return toComparisonItems(rows, today);
    }
}

/** numeric 컬럼은 문자열로 저장한다(정밀도 보존). */
function toInsertRow(
    report: EarningsReportUpsertInput
): typeof earningsReports.$inferInsert {
    return {
        symbol: report.symbol,
        earningsDate: report.earningsDate,
        epsActual: report.epsActual !== null ? String(report.epsActual) : null,
        epsEstimated:
            report.epsEstimated !== null ? String(report.epsEstimated) : null,
        revenueActual:
            report.revenueActual !== null ? String(report.revenueActual) : null,
        revenueEstimated:
            report.revenueEstimated !== null
                ? String(report.revenueEstimated)
                : null,
        lastUpdated: report.lastUpdated,
        rawPayload: report.rawPayload,
    };
}
