import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import type {
    EarningsReportComparisonItem,
    EarningsReportComparisonSlot,
    EarningsReportPeriod,
} from '@/shared/lib/types';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { earningsReports } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { todayKstIsoDate } from '@/shared/lib/dateKey';
import { isEarningsReportStale } from './lib/isEarningsReportStale';

export const EARNINGS_REPORT_FMP_LIMIT = 5;

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
            NEON_TRANSIENT_RETRY
        );
    }

    /** Next upcoming (or same-day) earnings entry for `symbol` on/after `fromDate` (ISO date) where no actual values have been reported yet; `null` when none. */
    async getNextForSymbol(
        symbol: string,
        fromDate: string
    ): Promise<EarningsCalendarItem | null> {
        const [row] = await this.db
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
            .where(
                and(
                    eq(earningsReports.symbol, symbol),
                    gte(earningsReports.earningsDate, fromDate),
                    isNull(earningsReports.epsActual),
                    isNull(earningsReports.revenueActual)
                )
            )
            .orderBy(earningsReports.earningsDate)
            .limit(1);

        if (row === undefined || row.lastUpdated === null) return null;

        return {
            symbol: row.symbol,
            earningsDate: row.earningsDate,
            epsActual: null,
            epsEstimated: toNumberOrNull(row.epsEstimated),
            revenueActual: null,
            revenueEstimated: toNumberOrNull(row.revenueEstimated),
            lastUpdated: row.lastUpdated,
        };
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
    const fetchedAt = await repo.getLatestFetchedAt(symbol);

    if (isEarningsReportStale(fetchedAt, Date.now())) {
        try {
            const client = getFundamentalDataProvider();
            const reports = await client.getEarningsReports(
                symbol,
                EARNINGS_REPORT_FMP_LIMIT
            );
            await repo.upsertMany(reports);
        } catch (err) {
            // Best-effort: analysis proceeds without earnings context if FMP fails.
            // 로깅은 남겨 운영자가 FMP 키 만료/타임아웃 등 장애를 감지할 수 있게 한다.
            console.warn('[getNextEarningsReport] FMP refresh failed:', err);
        }
    }

    return repo.getNextForSymbol(symbol, todayKstIsoDate());
}
