import { cacheLife, cacheTag } from 'next/cache';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleNewsRepository } from '@/infrastructure/db/newsRepository';
import { DrizzleEarningsCalendarRepository } from '@/infrastructure/db/earningsCalendarRepository';
import { DrizzleEarningsReportsRepository } from '@/infrastructure/db/earningsReportsRepository';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import { NEWS_LOOKBACK_MS } from '@/infrastructure/market/newsLookback';
import type { NewsRow } from '@/infrastructure/db/newsRepository';
import type {
    EarningsCalendarItem,
    EarningsReport,
    GradesEvent,
} from '@y0ngha/siglens-core';
import {
    NEWS_LIST_TTL_S,
    NEWS_GRADES_TTL_S,
    NEWS_EARNINGS_REPORT_TTL_S,
} from '@/lib/news/cacheTtl';

// ─── T1: 15 minutes ──────────────────────────────────────────────────────────

export async function getNewsList(symbol: string): Promise<NewsRow[]> {
    'use cache';
    cacheLife({ revalidate: NEWS_LIST_TTL_S });
    cacheTag(`news:list:${symbol}`);

    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);
    return repo.listBySymbol(symbol, NEWS_LOOKBACK_MS);
}

// ─── T2: 12 hours ────────────────────────────────────────────────────────────

export async function getGradeEvents(symbol: string): Promise<GradesEvent[]> {
    'use cache';
    cacheLife({ revalidate: NEWS_GRADES_TTL_S });
    cacheTag(`news:grades:${symbol}`);

    return new FmpFundamentalClient().getGrades(symbol);
}

// ─── T3: 7 days ──────────────────────────────────────────────────────────────

export async function getNextEarningsCalendar(
    symbol: string,
    today: string
): Promise<EarningsCalendarItem | null> {
    'use cache';
    cacheLife({ revalidate: NEWS_EARNINGS_REPORT_TTL_S });
    cacheTag(`news:earnings-calendar:${symbol}`);

    const { db } = getDatabaseClient();
    const repo = new DrizzleEarningsCalendarRepository(db);
    return repo.getNextForSymbol(symbol, today);
}

export async function getLatestEarningsReport(
    symbol: string
): Promise<EarningsReport | null> {
    'use cache';
    cacheLife({ revalidate: NEWS_EARNINGS_REPORT_TTL_S });
    cacheTag(`news:earnings-report:${symbol}`);

    const { db } = getDatabaseClient();
    const repo = new DrizzleEarningsReportsRepository(db);
    return repo.getLatestForSymbol(symbol);
}
