import { desc, eq, sql } from 'drizzle-orm';
import type { EarningsReport } from '@y0ngha/siglens-core';
import { earningsReports } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';

/**
 * Drizzle ORM implementation backed by the `earnings_reports` table.
 * Stores raw FMP earnings report payloads alongside the domain key fields.
 *
 * `rawPayload` is accepted as a separate argument because {@link EarningsReport}
 * only carries `symbol` and `earningsDate` — the raw response JSON must be
 * preserved in the DB without polluting the domain type.
 *
 * @param db - Drizzle-wrapped Neon database client; obtain via `createDatabaseClient`.
 */
export class DrizzleEarningsReportsRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * Insert or update a single earnings report.
     * On conflict (symbol, earnings_date), `raw_payload` and `fetched_at`
     * are replaced with the new values.
     *
     * @param report - Domain earnings report (symbol + earningsDate).
     * @param rawPayload - Full FMP API response object to persist for audit / re-parsing.
     */
    async upsert(report: EarningsReport, rawPayload: unknown): Promise<void> {
        await this.db
            .insert(earningsReports)
            .values({
                symbol: report.symbol,
                earningsDate: report.earningsDate,
                rawPayload,
            })
            .onConflictDoUpdate({
                target: [
                    earningsReports.symbol,
                    earningsReports.earningsDate,
                ],
                set: {
                    rawPayload: sql`excluded.raw_payload`,
                    fetchedAt: sql`excluded.fetched_at`,
                },
            });
    }

    /**
     * Return the most recently fetched earnings report for `symbol`,
     * or `null` when no report has been stored yet.
     */
    async getLatestForSymbol(symbol: string): Promise<EarningsReport | null> {
        const [row] = await this.db
            .select({
                symbol: earningsReports.symbol,
                earningsDate: earningsReports.earningsDate,
            })
            .from(earningsReports)
            .where(eq(earningsReports.symbol, symbol))
            .orderBy(desc(earningsReports.earningsDate))
            .limit(1);

        return row !== undefined ? toEarningsReport(row) : null;
    }
}

/** Map a raw DB row back to {@link EarningsReport}. */
function toEarningsReport(row: {
    symbol: string;
    earningsDate: string;
}): EarningsReport {
    return {
        symbol: row.symbol,
        earningsDate: row.earningsDate,
    };
}
