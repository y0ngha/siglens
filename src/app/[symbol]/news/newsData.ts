import { cache } from 'react';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleNewsRepository } from '@/entities/news-article';
import {
    DrizzleEarningsReportsRepository,
    isEarningsReportStale,
} from '@/entities/earnings-report';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import {
    getFmpUserFacingMessage,
    isFmpPaymentRequiredError,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';
import { NEWS_LOOKBACK_MS } from '@/entities/news-article';
import type { NewsRow } from '@/entities/news-article';
import type { GradesEvent } from '@y0ngha/siglens-core';
import type { EarningsReportComparisonItem } from '@/shared/lib/types';

// cacheComponents 비활성 기간 동안 'use cache' / cacheLife / cacheTag 모두 제거.
// 동일 요청 내 중복 호출(예: NewsPage 본문 + NewsListSection 내부)은 React.cache로
// per-request memoization을 적용해 DB/FMP 중복 조회를 막는다. cross-request 캐싱은
// 손실 — 이슈 #439 참조.
const fundamentalClient = getFundamentalDataProvider();
const EARNINGS_REPORT_FMP_LIMIT = 5;

export const getNewsList = cache(async (symbol: string): Promise<NewsRow[]> => {
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);
    return repo.listBySymbol(symbol, NEWS_LOOKBACK_MS);
});

// 애널리스트 등급 이벤트는 CachedFundamentalProvider가 `fundamental:grades:<SYM>` 키로
// 캐싱한다(페이지 fundamental 경로와 동일 키 공유). 빈 배열도 캐싱된다 — getGrades는
// FMP 장애 시 throw하므로 빈 배열은 "등급 이벤트 없음"이라는 정상·안정 결과다.
export const getGradeEvents = (symbol: string): Promise<GradesEvent[]> =>
    fundamentalClient.getGrades(symbol);

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

    if (isEarningsReportStale(fetchedAt)) {
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
