import type { GradesEvent } from '@y0ngha/siglens-core';

import { getDatabaseClient } from '@/shared/db/client';
import { EARNINGS_REPORT_FMP_LIMIT } from '@/entities/earnings-report/api';
import {
    isEarningsKnownEmpty,
    markEarningsEmpty,
} from '@/entities/earnings-report/server/earningsEmptyMarker';
import { DrizzleEarningsReportsRepository } from '@/entities/earnings-report/server/earningsReportsRepository';
import { isEarningsReportStale } from '@/entities/earnings-report/lib/isEarningsReportStale';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import {
    getFmpUserFacingKey,
    isFmpPaymentRequiredError,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';
import type { EarningsReportComparisonItem } from '@/shared/lib/types';

/**
 * 애널리스트 등급 이벤트(뉴스 탭 애널리스트 의견 섹션). CachedFundamentalProvider가
 * `fundamental:grades:<SYM>` 키로 캐싱하고 빈 배열도 캐싱한다 — FMP 장애는 throw이므로 빈 배열은
 * "이벤트 없음"이라는 정상 결과다. provider는 심볼별로 고른다(한국 종목은 yahoo 백엔드).
 */
export const getGradeEvents = (symbol: string): Promise<GradesEvent[]> =>
    getFundamentalDataProvider(symbol).getGrades(symbol);

/**
 * 실적 비교 항목(뉴스 탭 이벤트 캘린더). DB에서 읽고, 마지막 수집이 오래됐으면 provider에서 다시 받아
 * upsert한다 — 옮겨진 예정일의 옛 행을 지우고, 빈 응답(데이터 없는 심볼)은 TTL 동안 재호출하지 않는다.
 * 갱신이 실패해도 기존 행이 있으면 그것을 돌려주고, 하나도 없을 때만 throw한다(섹션이 경고로 degrade).
 *
 * @param today KST 날짜 키 — 지난 일정과 다가올 일정을 가른다.
 */
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
            const reports = await getFundamentalDataProvider(
                symbol
            ).getEarningsReports(symbol, EARNINGS_REPORT_FMP_LIMIT);
            await repo.upsertMany(reports);
            // 옮겨진 예정일의 옛 행을 지운다 — 남기면 비교 카드의 "다음 실적"이 옛 날짜를 고른다.
            await repo.pruneSupersededUpcoming(symbol, reports, today);
            // FMP가 빈 응답(데이터 없는 심볼)을 주면 TTL 동안 재호출을 막고(#567),
            // upsert로 DB가 바뀌지 않았으므로 재조회 없이 기존 비교 데이터를 반환한다.
            if (reports.length === 0) {
                await markEarningsEmpty(symbol);
                return comparisonItems;
            }
        } catch (error: unknown) {
            logFmpPaymentRequiredError(error);
            if (
                getFmpUserFacingKey(error) === null &&
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
