import { cache } from 'react';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleNewsRepository } from '@/entities/news-article';
import { DrizzleEarningsReportsRepository } from '@/entities/earnings-report';
import {
    FmpFundamentalClient,
    FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
} from '@/shared/api/fmp/fundamentalClient';
import {
    getFmpUserFacingMessage,
    isFmpPaymentRequiredError,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { MS_PER_DAY } from '@/shared/config/time';
import { NEWS_LOOKBACK_MS } from '@/entities/news-article';
import type { NewsRow } from '@/entities/news-article';
import type { GradesEvent } from '@y0ngha/siglens-core';
import type { EarningsReportComparisonItem } from '@/shared/lib/types';

// cacheComponents 비활성 기간 동안 'use cache' / cacheLife / cacheTag 모두 제거.
// 동일 요청 내 중복 호출(예: NewsPage 본문 + NewsListSection 내부)은 React.cache로
// per-request memoization을 적용해 DB/FMP 중복 조회를 막는다. cross-request 캐싱은
// 손실 — 이슈 #439 참조.
const fundamentalClient = new FmpFundamentalClient();
const EARNINGS_REPORT_FMP_LIMIT = 5;
const EARNINGS_REPORT_STALE_MS = MS_PER_DAY;

export const getNewsList = cache(async (symbol: string): Promise<NewsRow[]> => {
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);
    return repo.listBySymbol(symbol, NEWS_LOOKBACK_MS);
});

// 애널리스트 등급 이벤트는 펀더멘탈 데이터와 동일한 freshness 상수를 공유해 Redis에
// cross-region 캐싱한다. 빈 배열도 캐싱한다 — getGrades는 FMP 장애 시 throw하므로
// (getOptionalArray 미경유) 빈 배열은 "등급 이벤트 없음"이라는 정상·안정 결과다.
export const getGradeEvents = cache(
    async (symbol: string): Promise<GradesEvent[]> =>
        getOrSetCache(
            `fundamental:grades:${symbol.toUpperCase()}`,
            FMP_FUNDAMENTAL_REVALIDATE_SECONDS,
            () => fundamentalClient.getGrades(symbol)
        )
);

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
            logFmpPaymentRequiredError(error);
            if (
                getFmpUserFacingMessage(error) === null &&
                !isFmpPaymentRequiredError(error)
            ) {
                console.warn(
                    `[newsData] failed to refresh earnings reports for ${symbol}:`,
                    error
                );
            }
            if (comparisonItems.length === 0) throw error;
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
