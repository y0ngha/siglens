import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import type {
    EarningsReportComparisonItem,
    EarningsReportComparisonSlot,
    EarningsReportPeriod,
} from '@/domain/types';
import { NEON_TRANSIENT_RETRY } from '@/infrastructure/db/isNeonTransientError';
import { earningsReports } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import { withRetry } from '@/shared/lib/withRetry';

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
