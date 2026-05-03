import { desc, eq, sql } from 'drizzle-orm';
import type { EarningsReport } from '@y0ngha/siglens-core';
import { earningsReports } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';

// rawPayload is a separate arg because EarningsReport carries only symbol+earningsDate; full JSON is preserved for audit/re-parse.
export class DrizzleEarningsReportsRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** Upsert a single report; on conflict, `raw_payload` + `fetched_at` are replaced. */
    async upsert(report: EarningsReport, rawPayload: unknown): Promise<void> {
        await this.db
            .insert(earningsReports)
            .values({
                symbol: report.symbol,
                earningsDate: report.earningsDate,
                rawPayload,
            })
            .onConflictDoUpdate({
                target: [earningsReports.symbol, earningsReports.earningsDate],
                set: {
                    rawPayload: sql`excluded.raw_payload`,
                    fetchedAt: sql`excluded.fetched_at`,
                },
            });
    }

    /** Most recently fetched earnings report for `symbol`, or `null` when none stored. */
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

interface EarningsReportDbRow {
    symbol: string;
    earningsDate: string;
}

/** Map a raw DB row back to {@link EarningsReport}. */
function toEarningsReport(row: EarningsReportDbRow): EarningsReport {
    return {
        symbol: row.symbol,
        earningsDate: row.earningsDate,
    };
}
