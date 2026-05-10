import { and, eq, gte, sql } from 'drizzle-orm';
import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import { earningsCalendar } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';

export class DrizzleEarningsCalendarRepository {
    constructor(private readonly db: SiglensDatabase) {}

    // No-op on empty input. On conflict, all numeric/date fields are replaced via EXCLUDED.*.
    async upsertMany(items: EarningsCalendarItem[]): Promise<void> {
        const uniqueItems = dedupeCalendarItems(items);
        if (uniqueItems.length === 0) return;

        await this.db
            .insert(earningsCalendar)
            .values(uniqueItems.map(toCalendarRow))
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
                    fetchedAt: sql`excluded.fetched_at`,
                },
            });
    }

    /** Next upcoming (or same-day) earnings event for `symbol` on/after `fromDate` (ISO date); `null` when none. */
    async getNextForSymbol(
        symbol: string,
        fromDate: string
    ): Promise<EarningsCalendarItem | null> {
        const [row] = await this.db
            .select()
            .from(earningsCalendar)
            .where(
                and(
                    eq(earningsCalendar.symbol, symbol),
                    gte(earningsCalendar.earningsDate, fromDate)
                )
            )
            .orderBy(earningsCalendar.earningsDate)
            .limit(1);

        return row !== undefined ? toCalendarItem(row) : null;
    }
}

/** Map an {@link EarningsCalendarItem} to a DB insert row. */
export function toCalendarRow(
    item: EarningsCalendarItem
): typeof earningsCalendar.$inferInsert {
    return {
        symbol: item.symbol,
        earningsDate: item.earningsDate,
        epsActual: item.epsActual !== null ? String(item.epsActual) : null,
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

export function dedupeCalendarItems(
    items: EarningsCalendarItem[]
): EarningsCalendarItem[] {
    const uniqueByKey = new Map<string, EarningsCalendarItem>();

    for (const item of items) {
        const key = toCalendarKey(item);
        const existing = uniqueByKey.get(key);
        if (
            existing === undefined ||
            shouldReplaceCalendarItem(existing, item)
        ) {
            uniqueByKey.set(key, item);
        }
    }

    return Array.from(uniqueByKey.values());
}

function toCalendarKey(item: EarningsCalendarItem): string {
    return `${item.symbol}:${item.earningsDate}`;
}

function shouldReplaceCalendarItem(
    existing: EarningsCalendarItem,
    candidate: EarningsCalendarItem
): boolean {
    if (candidate.lastUpdated !== existing.lastUpdated) {
        return candidate.lastUpdated > existing.lastUpdated;
    }

    const candidateActualFieldCount = countActualFields(candidate);
    const existingActualFieldCount = countActualFields(existing);
    if (candidateActualFieldCount !== existingActualFieldCount) {
        return candidateActualFieldCount > existingActualFieldCount;
    }

    const candidatePopulatedFieldCount = countPopulatedFields(candidate);
    const existingPopulatedFieldCount = countPopulatedFields(existing);
    if (candidatePopulatedFieldCount !== existingPopulatedFieldCount) {
        return candidatePopulatedFieldCount > existingPopulatedFieldCount;
    }

    return true;
}

function countActualFields(item: EarningsCalendarItem): number {
    return [item.epsActual, item.revenueActual].filter(isPresent).length;
}

function countPopulatedFields(item: EarningsCalendarItem): number {
    return [
        item.epsActual,
        item.epsEstimated,
        item.revenueActual,
        item.revenueEstimated,
    ].filter(isPresent).length;
}

function isPresent(value: number | null): boolean {
    return value !== null;
}

interface EarningsCalendarDbRow {
    symbol: string;
    earningsDate: string;
    epsActual: string | null;
    epsEstimated: string | null;
    revenueActual: string | null;
    revenueEstimated: string | null;
    lastUpdated: string | null;
}

/** Map a raw DB row back to {@link EarningsCalendarItem}. */
function toCalendarItem(row: EarningsCalendarDbRow): EarningsCalendarItem {
    return {
        symbol: row.symbol,
        earningsDate: row.earningsDate,
        epsActual: row.epsActual !== null ? Number(row.epsActual) : null,
        epsEstimated:
            row.epsEstimated !== null ? Number(row.epsEstimated) : null,
        revenueActual:
            row.revenueActual !== null ? Number(row.revenueActual) : null,
        revenueEstimated:
            row.revenueEstimated !== null ? Number(row.revenueEstimated) : null,
        lastUpdated: requireLastUpdated(
            row.lastUpdated,
            row.symbol,
            row.earningsDate
        ),
    };
}

function requireLastUpdated(
    lastUpdated: string | null,
    symbol: string,
    earningsDate: string
): string {
    if (lastUpdated === null) {
        throw new Error(
            `earnings_calendar row missing lastUpdated for ${symbol} ${earningsDate}`
        );
    }
    return lastUpdated;
}
