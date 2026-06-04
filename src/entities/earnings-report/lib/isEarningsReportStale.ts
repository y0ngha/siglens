import { MS_PER_DAY } from '@/shared/config/time';

/**
 * earnings DB row가 stale(재fetch 필요)인지 — `fetchedAt` 단독 기준.
 *
 * news 페이지(getEarningsReportComparison)와 분석 경로(getNextEarningsReport)가
 * 이 함수를 공유해 staleness 판정을 단일화한다. 이전 news 경로는 "표시할 비교
 * 데이터 없음(comparisonItems.length === 0)"을 추가 OR 조건으로 두어, fetchedAt이
 * 방금 갱신된 종목도 매 요청 FMP refetch하는 영구 cache-miss 루프가 있었다. 표시
 * 가능 여부는 staleness와 무관하므로 fetchedAt만으로 판정한다.
 */
export const EARNINGS_REPORT_STALE_MS = MS_PER_DAY;

export function isEarningsReportStale(fetchedAt: Date | null): boolean {
    return (
        fetchedAt === null ||
        Date.now() - fetchedAt.getTime() > EARNINGS_REPORT_STALE_MS
    );
}
