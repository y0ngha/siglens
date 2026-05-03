import { and, between, gte, sql } from 'drizzle-orm';
import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import { earningsCalendar } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';

/**
 * Drizzle ORM implementation backed by the `earnings_calendar` table.
 * Handles bulk upsert of FMP earnings calendar data and targeted lookups.
 *
 * @param db - Drizzle-wrapped Neon database client; obtain via `createDatabaseClient`.
 */
export class DrizzleEarningsCalendarRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * Bulk-insert or update earnings calendar items.
     * On conflict (symbol, earnings_date), all numeric and date fields are
     * updated via `EXCLUDED.*` so stale estimates are replaced by fresh data.
     * Empty arrays are a no-op.
     */
    async upsertMany(items: EarningsCalendarItem[]): Promise<void> {
        if (items.length === 0) return;

        await this.db
            .insert(earningsCalendar)
            .values(items.map(toCalendarRow))
            .onConflictDoUpdate({
                target: [
                    earningsCalendar.symbol,
                    earningsCalendar.earningsDate,
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
            });
    }

    /**
     * Return the next upcoming (or same-day) earnings event for `symbol`
     * on or after `fromDate` (ISO date string, e.g. `"2025-08-01"`).
     * Returns `null` when no upcoming event is found.
     */
    async getNextForSymbol(
        symbol: string,
        fromDate: string
    ): Promise<EarningsCalendarItem | null> {
        const [row] = await this.db
            .select()
            .from(earningsCalendar)
            .where(
                and(
                    sql`${earningsCalendar.symbol} = ${symbol}`,
                    gte(earningsCalendar.earningsDate, fromDate)
                )
            )
            .orderBy(earningsCalendar.earningsDate)
            .limit(1);

        return row !== undefined ? toCalendarItem(row) : null;
    }

    /**
     * Return all earnings events whose `earningsDate` falls within
     * `[fromDate, toDate]` (inclusive, ISO date strings).
     */
    async listForRange(
        fromDate: string,
        toDate: string
    ): Promise<EarningsCalendarItem[]> {
        const rows = await this.db
            .select()
            .from(earningsCalendar)
            .where(
                between(earningsCalendar.earningsDate, fromDate, toDate)
            )
            .orderBy(earningsCalendar.earningsDate);

        return rows.map(toCalendarItem);
    }
}

/** Map an {@link EarningsCalendarItem} to a DB insert row. */
function toCalendarRow(item: EarningsCalendarItem) {
    return {
        symbol: item.symbol,
        earningsDate: item.earningsDate,
        epsActual:
            item.epsActual !== null ? String(item.epsActual) : null,
        epsEstimated:
            item.epsEstimated !== null ? String(item.epsEstimated) : null,
        revenueActual:
            item.revenueActual !== null ? String(item.revenueActual) : null,
        revenueEstimated:
            item.revenueEstimated !== null
                ? String(item.revenueEstimated)
                : null,
        lastUpdated: item.lastUpdated,
    };
}

/** Map a raw DB row back to {@link EarningsCalendarItem}. */
function toCalendarItem(row: {
    symbol: string;
    earningsDate: string;
    epsActual: string | null;
    epsEstimated: string | null;
    revenueActual: string | null;
    revenueEstimated: string | null;
    lastUpdated: string | null;
}): EarningsCalendarItem {
    return {
        symbol: row.symbol,
        earningsDate: row.earningsDate,
        epsActual: row.epsActual !== null ? Number(row.epsActual) : null,
        epsEstimated:
            row.epsEstimated !== null ? Number(row.epsEstimated) : null,
        revenueActual:
            row.revenueActual !== null ? Number(row.revenueActual) : null,
        revenueEstimated:
            row.revenueEstimated !== null
                ? Number(row.revenueEstimated)
                : null,
        lastUpdated: row.lastUpdated ?? '',
    };
}
