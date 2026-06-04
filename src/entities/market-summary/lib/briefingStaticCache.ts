import { unstable_cache } from 'next/cache';
import {
    type MarketBriefingResponse,
    type MarketSummaryData,
    peekBriefingCache,
} from '@y0ngha/siglens-core';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/**
 * ISR static-safe peek of the cached briefing. core peekBriefingCache(읽기전용)를 Next
 * data cache로 감싼다. 키는 date-hour(매시 자연 무효화)로 충분 — 같은 시간대면 같은
 * cached briefing. revalidate=1h, market-summary tag.
 */
export function peekBriefingStatic(
    summary: MarketSummaryData,
    dateHour: string
): Promise<MarketBriefingResponse | null> {
    return unstable_cache(
        () => peekBriefingCache(summary),
        ['briefing-peek-static', dateHour],
        { revalidate: SECONDS_PER_HOUR, tags: ['market-summary'] }
    )();
}
