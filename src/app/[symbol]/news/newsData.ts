import { cacheLife, cacheTag } from 'next/cache';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleNewsRepository } from '@/infrastructure/db/newsRepository';
import { DrizzleEarningsCalendarRepository } from '@/infrastructure/db/earningsCalendarRepository';
import { DrizzleEarningsReportsRepository } from '@/infrastructure/db/earningsReportsRepository';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import { MS_PER_DAY } from '@/domain/constants/time';
import { NEWS_LOOKBACK_MS } from '@/infrastructure/market/newsLookback';
import type { NewsRow } from '@/infrastructure/db/newsRepository';
import type { EarningsCalendarItem, GradesEvent } from '@y0ngha/siglens-core';
import type { EarningsReportComparisonItem } from '@/domain/types';
import {
    NEWS_EARNINGS_CALENDAR_TTL_S,
    NEWS_GRADES_TTL_S,
    NEWS_LIST_TTL_S,
} from '@/lib/news/cacheTtl';

const fundamentalClient = new FmpFundamentalClient();
const EARNINGS_REPORT_FMP_LIMIT = 5;
const EARNINGS_REPORT_STALE_MS = MS_PER_DAY;

export async function getNewsList(symbol: string): Promise<NewsRow[]> {
    'use cache';
    cacheLife({ revalidate: NEWS_LIST_TTL_S });
    cacheTag(`news:list:${symbol}`);

    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);
    return repo.listBySymbol(symbol, NEWS_LOOKBACK_MS);
}

export async function getGradeEvents(symbol: string): Promise<GradesEvent[]> {
    'use cache';
    cacheLife({ revalidate: NEWS_GRADES_TTL_S });
    cacheTag(`news:grades:${symbol}`);

    return fundamentalClient.getGrades(symbol);
}

export async function getNextEarningsCalendar(
    symbol: string,
    today: string
): Promise<EarningsCalendarItem | null> {
    'use cache';
    cacheLife({ revalidate: NEWS_EARNINGS_CALENDAR_TTL_S });
    cacheTag(`news:earnings-calendar:${symbol}`);

    const { db } = getDatabaseClient();
    const repo = new DrizzleEarningsCalendarRepository(db);
    return repo.getNextForSymbol(symbol, today);
}

export async function getEarningsReportComparison(
    symbol: string,
    today: string
): Promise<EarningsReportComparisonItem[]> {
    const { db } = getDatabaseClient();
    const repo = new DrizzleEarningsReportsRepository(db);
    const [fetchedAt, comparisonItems] = await Promise.all([
        repo.getLatestFetchedAt(symbol),
        repo.getComparisonItems(symbol, today),
    ]);

    if (shouldRefreshEarningsReports(fetchedAt, comparisonItems)) {
        try {
            const reports = await fundamentalClient.getEarningsReports(
                symbol,
                EARNINGS_REPORT_FMP_LIMIT
            );
            await repo.upsertMany(reports);
        } catch (error: unknown) {
            console.warn(
                `[newsData] failed to refresh earnings reports for ${symbol}:`,
                error
            );
            return comparisonItems;
        }

        return repo.getComparisonItems(symbol, today);
    }

    return comparisonItems;
}

function shouldRefreshEarningsReports(
    fetchedAt: Date | null,
    comparisonItems: EarningsReportComparisonItem[]
): boolean {
    return (
        comparisonItems.length === 0 ||
        fetchedAt === null ||
        Date.now() - fetchedAt.getTime() > EARNINGS_REPORT_STALE_MS
    );
}
