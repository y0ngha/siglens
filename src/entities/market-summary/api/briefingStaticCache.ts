import 'server-only';
import { unstable_cache } from 'next/cache';
import {
    type MarketBriefingResponse,
    type MarketSummaryData,
    peekBriefingCache,
} from '@y0ngha/siglens-core';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { marketBriefingContextOf } from '../lib/marketBriefingContext';

/**
 * ISR static-safe peek of the cached briefing. core peekBriefingCache(읽기전용)를 Next
 * data cache로 감싼다. 키는 date-hour(매시 자연 무효화)로 충분 — 같은 시간대면 같은
 * cached briefing. revalidate=1h, `market:briefing` tag.
 * 태그는 summary/sector와 분리한다(공유 시 한 무효화가 셋 다 날리는 blast-radius 방지).
 */
export function peekBriefingStatic(
    summary: MarketSummaryData,
    dateHour: string,
    scope: DashboardScope
): Promise<MarketBriefingResponse | null> {
    // core 캐시 키에 접히는 context — 쓰기 경로(submitMarketBriefingAction)와
    // **같은 헬퍼**로 만들어야 peek이 실제로 쓰인 키를 읽는다.
    const context = marketBriefingContextOf(scope, summary);
    return unstable_cache(
        () => peekBriefingCache(summary, context),
        // `scope`가 키에 **반드시** 있어야 한다. 예전 키는 `dateHour` 하나뿐이라
        // 미국·한국이 같은 시간대에 같은 엔트리를 공유했다 — 먼저 렌더된 쪽의
        // 브리핑이 다른 시장 페이지에 그대로 나간다.
        ['briefing-peek-static', scope.id, dateHour],
        { revalidate: SECONDS_PER_HOUR, tags: [`market:briefing:${scope.id}`] }
    )();
}
