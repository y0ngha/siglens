import { getDatabaseClient } from '@/shared/db/client';
import {
    DrizzleEarningsReportsRepository,
    EARNINGS_REPORT_FMP_LIMIT,
    isEarningsKnownEmpty,
    isEarningsReportStale,
    markEarningsEmpty,
} from '@/entities/earnings-report';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import {
    getFmpUserFacingMessage,
    isFmpPaymentRequiredError,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';
import type { GradesEvent } from '@y0ngha/siglens-core';
import type { EarningsReportComparisonItem } from '@/shared/lib/types';

// cacheComponents 비활성 기간 동안 'use cache' / cacheLife / cacheTag 모두 제거.
// (News list per-request cache는 entities/news-article의 getNewsList로 이동 — /news와
// /overall 두 라우트가 entity 레이어를 공유하기 위함.) cross-request 캐싱은 손실 — 이슈 #439.
const fundamentalClient = getFundamentalDataProvider();

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

    if (
        isEarningsReportStale(fetchedAt, Date.now()) &&
        !(await isEarningsKnownEmpty(symbol))
    ) {
        try {
            const reports = await fundamentalClient.getEarningsReports(
                symbol,
                EARNINGS_REPORT_FMP_LIMIT
            );
            await repo.upsertMany(reports);
            // FMP가 빈 응답(데이터 없는 심볼)을 주면 TTL 동안 재호출을 막고(#567),
            // upsert로 DB가 바뀌지 않았으므로 재조회 없이 기존 비교 데이터를 반환한다.
            if (reports.length === 0) {
                await markEarningsEmpty(symbol);
                return comparisonItems;
            }
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
