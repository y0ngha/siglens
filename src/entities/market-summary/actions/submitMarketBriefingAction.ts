'use server';

import type { MarketBriefingActionResult } from '@/shared/lib/types';
import { isBot } from '@/shared/api/isBot';
import { runBriefing } from '@y0ngha/siglens-core';
import { headers } from 'next/headers';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';
import { getCachedMarketSummary } from '../api/marketSummaryCache';
import {
    dashboardScopeOf,
    isDashboardScopeId,
} from '@/shared/config/dashboardScope';

/**
 * briefing 클라 트리거. 봇이면 차단(job 미제출), 아니면 runBriefing(내부에서
 * summary 재조회 — redis HIT). cached/submitted 결과를 반환. headers()는 클라 호출
 * 경로라 ISR과 무관.
 */
export async function submitMarketBriefingAction(
    scope: string,
    signal?: AbortSignal
): Promise<MarketBriefingActionResult> {
    try {
        const requestHeaders = await headers();
        if (isBot(requestHeaders)) {
            return { briefing: null, botBlocked: true };
        }
        // 직렬화를 건너온 값이라 런타임에서 좁힌다.
        if (!isDashboardScopeId(scope)) {
            console.error('[submitMarketBriefingAction] unknown scope:', scope);
            return { ok: false, error: 'server_error' };
        }
        const resolved = dashboardScopeOf(scope);
        // core `runBriefing`은 시장을 모른다 — 프롬프트가 지수·섹터 행을 데이터로만
        // 읽고, 캐시 키는 그 데이터 해시에서 나온다. 따라서 한국 요약을 넣으면
        // 한국 브리핑이 나오고 미국 것과 키도 자연히 갈린다.
        const summary = await getCachedMarketSummary(
            marketDataProviderFor(resolved.id),
            resolved
        );
        const briefing = await runBriefing(summary, { signal });
        return { briefing, botBlocked: false };
    } catch (e) {
        console.error('[submitMarketBriefingAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
