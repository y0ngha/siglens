import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import { DrizzleEarningsReportsRepository } from '@/entities/earnings-report';
import { isEarningsReportStale } from './isEarningsReportStale';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { todayKstIsoDate } from '@/shared/lib/dateKey';
import type { SiglensDatabase } from '@/shared/db/types';

const EARNINGS_REPORT_FMP_LIMIT = 5;

/**
 * Returns the next upcoming earnings entry for `symbol`, refreshing from FMP if
 * the DB has no data or the last fetch is older than 24 hours.
 * Used by analysis actions that run independently of the news page visit.
 *
 * TODO(#565): 이 함수는 DB·FMP·`Date.now()` side effect를 포함하므로 순수 함수
 * 전용 레이어인 `entities/{slice}/lib/`(MISTAKES §Architecture #0.7) 규약에 부합하지
 * 않는다(pre-existing). `api.ts`로 이동 예정 — https://github.com/y0ngha/siglens/issues/565
 * (이번 PR #564는 캐시/gate 수정 범위라 별도 PR로 분리.)
 */
export async function getNextEarningsReport(
    symbol: string,
    db: SiglensDatabase
): Promise<EarningsCalendarItem | null> {
    const repo = new DrizzleEarningsReportsRepository(db);
    const fetchedAt = await repo.getLatestFetchedAt(symbol);

    if (isEarningsReportStale(fetchedAt, Date.now())) {
        try {
            const client = getFundamentalDataProvider();
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
