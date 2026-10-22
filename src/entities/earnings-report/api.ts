import { and, asc, desc, eq, gte, isNull, notInArray, sql } from 'drizzle-orm';
import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import type {
    EarningsReportComparisonItem,
    EarningsReportComparisonSlot,
    EarningsReportPeriod,
} from '@/shared/lib/types';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { earningsReports } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { MS_PER_DAY, SECONDS_PER_DAY } from '@/shared/config/time';
import { getRedisClient } from '@/shared/cache/redisClient';
import { isEarningsReportStale } from './lib/isEarningsReportStale';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

export const EARNINGS_REPORT_FMP_LIMIT = 5;

/**
 * 빈 earnings 응답 마커 TTL. staleness gate(24h)와 동일하게 두어 데이터 유무와 무관하게
 * 심볼당 하루 최대 1회만 FMP를 조회하도록 통일한다.
 */
export const EARNINGS_EMPTY_MARKER_TTL_SECONDS = SECONDS_PER_DAY;

function earningsEmptyMarkerKey(symbol: string): string {
    return `earnings:empty:${symbol.toUpperCase()}`;
}

/**
 * earnings 데이터가 없는 것으로 최근(TTL 내) 확인된 심볼인지 여부.
 *
 * ETF·지수·잘못된 심볼은 FMP가 빈 응답을 주어 `earningsReports` 테이블에 레코드가
 * 생기지 않는다 → `getLatestFetchedAt`이 항상 `null` → staleness가 항상 stale로 판정되어
 * 매 요청 FMP를 호출하는 영구 cache-miss 루프가 발생한다(#567). 이 마커가 있으면 TTL 동안
 * FMP 재호출을 건너뛴다. Redis 미설정/장애 시 `false`로 degrade(기존 동작대로 fetch).
 */
export async function isEarningsKnownEmpty(symbol: string): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    try {
        return (await redis.get(earningsEmptyMarkerKey(symbol))) !== null;
    } catch (error) {
        console.error('[isEarningsKnownEmpty] redis get failed:', error);
        return false;
    }
}

/**
 * 심볼을 "earnings 없음"으로 `EARNINGS_EMPTY_MARKER_TTL_SECONDS` 동안 마킹.
 * Redis 미설정/장애 시 no-op(throw하지 않음).
 */
export async function markEarningsEmpty(symbol: string): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(earningsEmptyMarkerKey(symbol), 1, {
            ex: EARNINGS_EMPTY_MARKER_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[markEarningsEmpty] redis set failed:', error);
    }
}

export interface EarningsReportUpsertInput {
    symbol: string;
    earningsDate: string;
    epsActual: number | null;
    epsEstimated: number | null;
    revenueActual: number | null;
    revenueEstimated: number | null;
    lastUpdated: string | null;
    rawPayload: unknown;
}

/**
 * 다음 실적 일정 + 그 날짜가 확정 공시인지.
 *
 * `dateConfirmed`는 프로바이더가 확정 여부를 알려 줄 때만 boolean이다 — yahoo(KR)는
 * `calendarEvents.earnings.isEarningsDateEstimate`를 `rawPayload.isEstimate`로 남기고,
 * FMP `/stable/earnings`는 확정 플래그도 발표 시각(장전·장후)도 주지 않아 `null`이다.
 * core의 `EarningsCalendarItem`을 넓히지 않고 siglens 쪽에서만 붙인다 — 분석 경로
 * (`getNextEarningsReport`)가 core에 넘기는 모양은 그대로 둔다.
 */
export interface NextEarningsSchedule extends EarningsCalendarItem {
    dateConfirmed: boolean | null;
}

/**
 * 프로바이더 응답 중 `today` 이후의 **실적 미발표** 행 날짜.
 *
 * 비어 있지 않으면 이 응답이 "지금의 예정일"을 들고 있다는 뜻이라, DB에 남은 다른
 * 미래 미발표 행은 옛 예정일(회사가 날짜를 옮기기 전 값)로 본다
 * (`pruneSupersededUpcoming`). 비어 있으면(과거 행만 왔거나 빈 응답) 대체할 일정이
 * 없으므로 아무것도 지우지 않는다 — 프로바이더가 일시적으로 일정을 빠뜨린 것과
 * 일정이 옮겨진 것을 구별할 수 없다.
 */
export function upcomingUnreportedDates(
    reports: readonly EarningsReportUpsertInput[],
    today: string
): string[] {
    return reports
        .filter(
            r =>
                r.earningsDate >= today &&
                r.epsActual === null &&
                r.revenueActual === null
        )
        .map(r => r.earningsDate);
}

/** yahoo 어댑터가 남긴 `rawPayload.isEstimate`를 확정 여부로 바꾼다. 플래그가 없으면 `null`(모름). */
export function dateConfirmedFromPayload(rawPayload: unknown): boolean | null {
    if (
        rawPayload === null ||
        typeof rawPayload !== 'object' ||
        !('isEstimate' in rawPayload)
    ) {
        return null;
    }
    const flag = rawPayload.isEstimate;
    return typeof flag === 'boolean' ? !flag : null;
}

/** core에 넘기는 `EarningsCalendarItem` 필드만 고른다 — 확정 여부(`dateConfirmed`)는 core 계약에 없다. */
export function toCalendarItem(
    schedule: NextEarningsSchedule
): EarningsCalendarItem {
    return {
        symbol: schedule.symbol,
        earningsDate: schedule.earningsDate,
        epsActual: schedule.epsActual,
        epsEstimated: schedule.epsEstimated,
        revenueActual: schedule.revenueActual,
        revenueEstimated: schedule.revenueEstimated,
        lastUpdated: schedule.lastUpdated,
    };
}

export class DrizzleEarningsReportsRepository {
    constructor(private readonly db: SiglensDatabase) {}

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

    async getLatestFetchedAt(symbol: string): Promise<Date | null> {
        const [row] = await this.db
            .select({ fetchedAt: earningsReports.fetchedAt })
            .from(earningsReports)
            .where(eq(earningsReports.symbol, symbol))
            .orderBy(desc(earningsReports.fetchedAt))
            .limit(1);

        return row?.fetchedAt ?? null;
    }

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

interface EarningsReportDataRow {
    symbol: string;
    earningsDate: string;
    epsActual: string | null;
    epsEstimated: string | null;
    revenueActual: string | null;
    revenueEstimated: string | null;
    lastUpdated: string | null;
}

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

export function toComparisonItems(
    rows: EarningsReportDataRow[],
    today: string
): EarningsReportComparisonItem[] {
    const completed = rows
        .filter(row => row.earningsDate <= today && hasActualValue(row))
        .toSorted(compareEarningsDateDesc);
    const upcoming = rows
        .filter(
            row =>
                row.earningsDate >= today &&
                !hasActualValue(row) &&
                hasEstimateValue(row)
        )
        .toSorted(compareEarningsDateAsc);

    if (upcoming.length > 0) {
        return [
            ...assignPastSlots(completed.slice(0, 2).toReversed()),
            toComparisonItem(upcoming[0], 'future', 'recent-or-future'),
        ];
    }

    return assignTrailingSlots(completed.slice(0, 3).toReversed());
}

function assignPastSlots(
    rows: EarningsReportDataRow[]
): EarningsReportComparisonItem[] {
    const slots: EarningsReportComparisonSlot[] =
        rows.length === 1 ? ['past-1'] : ['past-2', 'past-1'];

    return rows.map((row, index) =>
        toComparisonItem(row, 'past', slots[index])
    );
}

function assignTrailingSlots(
    rows: EarningsReportDataRow[]
): EarningsReportComparisonItem[] {
    const slotsByLength: Record<number, EarningsReportComparisonSlot[]> = {
        0: [],
        1: ['recent-or-future'],
        2: ['past-1', 'recent-or-future'],
        3: ['past-2', 'past-1', 'recent-or-future'],
    };
    const slots = slotsByLength[rows.length] ?? slotsByLength[0];

    return rows.map((row, index) =>
        toComparisonItem(row, 'past', slots[index])
    );
}

function toComparisonItem(
    row: EarningsReportDataRow,
    period: EarningsReportPeriod,
    slot: EarningsReportComparisonSlot
): EarningsReportComparisonItem {
    return {
        symbol: row.symbol,
        earningsDate: row.earningsDate,
        epsActual: toNumberOrNull(row.epsActual),
        epsEstimated: toNumberOrNull(row.epsEstimated),
        revenueActual: toNumberOrNull(row.revenueActual),
        revenueEstimated: toNumberOrNull(row.revenueEstimated),
        lastUpdated: row.lastUpdated,
        period,
        slot,
    };
}

function hasActualValue(row: EarningsReportDataRow): boolean {
    return row.epsActual !== null || row.revenueActual !== null;
}

function compareEarningsDateAsc(
    a: EarningsReportDataRow,
    b: EarningsReportDataRow
): number {
    return a.earningsDate.localeCompare(b.earningsDate);
}

function compareEarningsDateDesc(
    a: EarningsReportDataRow,
    b: EarningsReportDataRow
): number {
    return b.earningsDate.localeCompare(a.earningsDate);
}

function toNumberOrNull(value: string | null): number | null {
    return value !== null ? Number(value) : null;
}

export function dedupeEarningsReportInputs(
    reports: EarningsReportUpsertInput[]
): EarningsReportUpsertInput[] {
    const uniqueByKey = new Map<string, EarningsReportUpsertInput>();

    for (const report of reports) {
        const key = toReportKey(report);
        const existing = uniqueByKey.get(key);
        if (
            existing === undefined ||
            shouldReplaceReportInput(existing, report)
        ) {
            uniqueByKey.set(key, report);
        }
    }

    return Array.from(uniqueByKey.values());
}

function toReportKey(report: EarningsReportUpsertInput): string {
    return `${report.symbol}:${report.earningsDate}`;
}

function shouldReplaceReportInput(
    existing: EarningsReportUpsertInput,
    candidate: EarningsReportUpsertInput
): boolean {
    if (candidate.lastUpdated !== existing.lastUpdated) {
        if (candidate.lastUpdated === null) return false;
        if (existing.lastUpdated === null) return true;
        return candidate.lastUpdated > existing.lastUpdated;
    }

    const candidatePopulatedFieldCount = countPopulatedInputFields(candidate);
    const existingPopulatedFieldCount = countPopulatedInputFields(existing);
    if (candidatePopulatedFieldCount !== existingPopulatedFieldCount) {
        return candidatePopulatedFieldCount > existingPopulatedFieldCount;
    }

    return true;
}

function countPopulatedInputFields(report: EarningsReportUpsertInput): number {
    return [
        report.epsActual,
        report.epsEstimated,
        report.revenueActual,
        report.revenueEstimated,
    ].filter(isPresent).length;
}

function isPresent(value: number | null): boolean {
    return value !== null;
}

function hasEstimateValue(row: EarningsReportDataRow): boolean {
    return row.epsEstimated !== null || row.revenueEstimated !== null;
}

/**
 * Returns the next upcoming earnings entry for `symbol`, refreshing from FMP if
 * the DB has no data or the last fetch is older than 24 hours.
 * Used by analysis actions that run independently of the news page visit.
 *
 * DB·FMP·`Date.now()` side effect를 포함하는 use-case이므로 순수 함수 전용 레이어
 * (lib/)가 아니라 api.ts(server-only repository/API 계층)에 둔다. staleness 판정은
 * 순수 함수 `isEarningsReportStale`(lib/)에 위임하고, `Date.now()`는 여기
 * (infrastructure 경계)에서 주입한다.
 *
 * I/O 보호는 의도적으로 비대칭이다: FMP refresh만 best-effort(try-catch로 삼켜 분석이
 * earnings 없이 진행)이고, DB I/O(getLatestFetchedAt/getNextForSymbol) 오류는 호출자
 * (Server Action)의 try-catch에 위임한다.
 */
export async function getNextEarningsReport(
    symbol: string,
    db: SiglensDatabase
): Promise<EarningsCalendarItem | null> {
    const repo = new DrizzleEarningsReportsRepository(db);
    const today = await refreshEarningsIfStale(repo, symbol);
    return repo.getNextForSymbol(symbol, today);
}

/**
 * {@link getNextEarningsReport}와 같은 갱신 뒤, 확정 여부(`dateConfirmed`)까지 붙여 읽는다.
 * 에이전트 도구(`get_fundamentals`)용 — 분석 경로는 core 모양 그대로인 위 함수를 쓴다.
 */
export async function getNextEarningsSchedule(
    symbol: string,
    db: SiglensDatabase
): Promise<NextEarningsSchedule | null> {
    const repo = new DrizzleEarningsReportsRepository(db);
    const today = await refreshEarningsIfStale(repo, symbol);
    return repo.getNextScheduleForSymbol(symbol, today);
}

/**
 * 24h 신선도 게이트를 넘었으면 프로바이더에서 다시 받아 upsert하고 옛 예정일을 정리한다.
 * 갱신은 best-effort(실패를 삼킨다). 조회 기준일(KST 오늘)을 돌려준다.
 */
async function refreshEarningsIfStale(
    repo: DrizzleEarningsReportsRepository,
    symbol: string
): Promise<string> {
    const today = kstDateKey(new Date());
    const fetchedAt = await repo.getLatestFetchedAt(symbol);

    if (
        isEarningsReportStale(fetchedAt, Date.now()) &&
        !(await isEarningsKnownEmpty(symbol))
    ) {
        try {
            const client = getFundamentalDataProvider(symbol);
            const reports = await client.getEarningsReports(
                symbol,
                EARNINGS_REPORT_FMP_LIMIT
            );
            await repo.upsertMany(reports);
            await repo.pruneSupersededUpcoming(symbol, reports, today);
            // FMP가 빈 응답(데이터 없는 심볼)을 주면 TTL 동안 재호출을 막는다(#567).
            if (reports.length === 0) await markEarningsEmpty(symbol);
        } catch (err) {
            // Best-effort: analysis proceeds without earnings context if FMP fails.
            // 로깅은 남겨 운영자가 FMP 키 만료/타임아웃 등 장애를 감지할 수 있게 한다.
            console.warn('[getNextEarningsReport] FMP refresh failed:', err);
        }
    }

    return today;
}

/** 분석에 넘길 실적 발표일 조회 범위 — 최근 2년이면 눌림 해석 윈도우에 충분하다. */
export const EARNINGS_DATES_LOOKBACK_DAYS = 730;

/**
 * 분석 프롬프트·눌림 caveat에 넘길 이 회사의 실적 발표일(`YYYY-MM-DD`, 최근 2년 + 예정)을
 * DB에서 읽는다. 갱신(FMP)은 하지 않는다 — 이미 `getNextEarningsReport`를 부르는 호출자가
 * 그 뒤에 이어 붙이는 용도다.
 *
 * core는 `undefined`·`[]`를 "캘린더 모름"(안전 쪽)으로 취급한다. 행이 없으면(크립토·KR 등
 * 실적 소스가 없는 심볼) 또는 DB가 실패하면 `undefined`를 돌려주고 던지지 않는다 — 이 값
 * 때문에 분석이 실패해선 안 된다.
 *
 * 이 값은 분석 캐시 키에 접히지 않는다. 모든 경로가 같은 DB 테이블을 읽고(프리웜·종합 경로만
 * 읽기 전에 갱신한다), 그래서 방금 나온 실적 발표가 캐시된 본문에는 TTL까지 늦게 반영될 수
 * 있어도 실적이 아닌 것을 회사의 실적으로 표기하는 경로는 없다.
 */
export async function listEarningsDates(
    symbol: string,
    db: SiglensDatabase
): Promise<readonly string[] | undefined> {
    try {
        const from = new Date(
            Date.now() - EARNINGS_DATES_LOOKBACK_DAYS * MS_PER_DAY
        );
        const dates = await new DrizzleEarningsReportsRepository(
            db
        ).listDatesSince(symbol, kstDateKey(from));
        return dates.length > 0 ? dates : undefined;
    } catch (err) {
        console.warn('[listEarningsDates] lookup failed:', err);
        return undefined;
    }
}

/**
 * `getNextEarningsReport`(신선도 판정·FMP 갱신·빈 응답 마커 재사용 → 새 Redis 호출 없음)로
 * DB를 최신으로 만든 뒤 {@link listEarningsDates}로 읽는다. 어떤 단계가 실패해도 던지지 않고
 * `undefined`를 돌려준다.
 */
export async function resolveEarningsDates(
    symbol: string,
    db: SiglensDatabase
): Promise<readonly string[] | undefined> {
    try {
        await getNextEarningsReport(symbol, db);
    } catch (err) {
        console.warn('[resolveEarningsDates] refresh failed:', err);
    }
    return listEarningsDates(symbol, db);
}

/**
 * 이미 시작한 갱신(`getNextEarningsReport` promise)이 끝난 뒤 {@link listEarningsDates}로
 * 읽는다. 갱신을 또 돌리면 FMP 호출이 겹치므로 호출자가 쥔 promise를 재사용한다. 갱신이
 * 거부돼도(그 오류는 호출자가 자기 `Promise.all`에서 다룬다) 여기서는 던지지 않고
 * `undefined`("캘린더 모름")로 끝낸다.
 */
export function listEarningsDatesAfterRefresh(
    refresh: Promise<unknown>,
    symbol: string,
    db: SiglensDatabase
): Promise<readonly string[] | undefined> {
    return refresh.then(
        () => listEarningsDates(symbol, db),
        () => undefined
    );
}
