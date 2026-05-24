import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/domain/constants/time';
import { DrizzleEarningsReportsRepository } from '@/infrastructure/db/earningsReportsRepository';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import { todayKstIsoDate } from '@/shared/lib/dateKey';
import type { SiglensDatabase } from '@/shared/db/types';

const EARNINGS_REPORT_FMP_LIMIT = 5;
const EARNINGS_REPORT_STALE_MS = MS_PER_DAY;

/**
 * Returns the next upcoming earnings entry for `symbol`, refreshing from FMP if
 * the DB has no data or the last fetch is older than 24 hours.
 * Used by analysis actions that run independently of the news page visit.
 */
export async function getNextEarningsReport(
    symbol: string,
    db: SiglensDatabase
): Promise<EarningsCalendarItem | null> {
    const repo = new DrizzleEarningsReportsRepository(db);
    const fetchedAt = await repo.getLatestFetchedAt(symbol);

    const isStale =
        fetchedAt === null ||
        Date.now() - fetchedAt.getTime() > EARNINGS_REPORT_STALE_MS;

    if (isStale) {
        try {
            const client = new FmpFundamentalClient();
            const reports = await client.getEarningsReports(
                symbol,
                EARNINGS_REPORT_FMP_LIMIT
            );
            await repo.upsertMany(reports);
        } catch {
            // Best-effort: analysis proceeds without earnings context if FMP fails
        }
    }

    return repo.getNextForSymbol(symbol, todayKstIsoDate());
}
