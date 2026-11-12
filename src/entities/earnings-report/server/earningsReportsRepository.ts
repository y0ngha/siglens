import {
    and,
    asc,
    desc,
    eq,
    gte,
    isNotNull,
    isNull,
    lte,
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
     * 프로바이더가 **추정일**이라고 표시한 일정(`dateConfirmed === false`, yahoo `isEarningsDateEstimate`)도
     * 넘기되 `dateConfirmed: false`를 싣는다(`toCalendarItem`). core(2.32.0~)가 그 행에 추정일 표식을 달고
     * 프롬프트가 "예정(미확정)"으로 쓰게 한다. 예전에는 실을 자리가 없어 `null`로 뺐는데, 그러면 국내 종목은
     * 다음 실적일이 늘 추정치라 뉴스 탭 다가오는 일정에 실적이 한 번도 나가지 않았다(2026-11 운영: 삼성전자·
     * SK하이닉스가 일반 CPI 불릿만 받았다). 이 행을 받는 곳은 뉴스 분석과 종합 분석의 뉴스 축뿐이다.
     */
    async getNextForSymbol(
        symbol: string,
        fromDate: string
    ): Promise<EarningsCalendarItem | null> {
        const schedule = await this.getNextScheduleForSymbol(symbol, fromDate);
        return schedule === null ? null : toCalendarItem(schedule);
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

    /**
     * `today`(KST 날짜 키)까지 실제 EPS가 발표된 행을 최신순으로 `limit`개 — 펀더멘털 탭 사실 블록의
     * "EPS 연속 상회/하회"와 직전 서프라이즈 입력이다. 예상치가 없는 행도 돌려주고 판정은 호출부가 한다.
     */
    async listReportedEps(
        symbol: string,
        today: string,
        limit: number
    ): Promise<
        {
            earningsDate: string;
            epsActual: number | null;
            epsEstimated: number | null;
        }[]
    > {
        const rows = await this.db
            .select({
                earningsDate: earningsReports.earningsDate,
                epsActual: earningsReports.epsActual,
                epsEstimated: earningsReports.epsEstimated,
            })
            .from(earningsReports)
            .where(
                and(
                    eq(earningsReports.symbol, symbol),
                    lte(earningsReports.earningsDate, today),
                    isNotNull(earningsReports.epsActual)
                )
            )
            .orderBy(desc(earningsReports.earningsDate))
            .limit(limit);

        return rows.map(row => ({
            earningsDate: row.earningsDate,
            epsActual: toNumberOrNull(row.epsActual),
            epsEstimated: toNumberOrNull(row.epsEstimated),
        }));
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
