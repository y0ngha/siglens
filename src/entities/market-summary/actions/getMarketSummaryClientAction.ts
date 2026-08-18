'use server';

import type { MarketSummaryActionResult } from '@/shared/lib/types';
import { isE2E } from '@/shared/api/e2eEnv';
import { cookies } from 'next/headers';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';
import { getCachedMarketSummary } from '../api/marketSummaryCache';
import {
    dashboardScopeOf,
    isDashboardScopeId,
} from '@/shared/config/dashboardScope';

/**
 * 클라(useMarketSummary) 전용 summary fetch. RSC prefetch는 getMarketSummaryStatic
 * (정적)을 쓰고, 클라는 이 action으로 redis 실시간 값을 받는다. E2E force-partial
 * 쿠키 seam을 여기에 유지한다(정적 경로는 쿠키를 못 읽으므로). 라우트 렌더가 아닌
 * 클라 호출이라 cookies() 사용이 ISR을 깨지 않는다.
 */
export async function getMarketSummaryClientAction(
    scope: string
): Promise<MarketSummaryActionResult> {
    try {
        // 직렬화를 건너온 값이라 런타임에서 좁힌다 — 미국으로 조용히 폴백하면
        // 한국 페이지가 미국 시세를 그리고도 아무 신호가 없다.
        if (!isDashboardScopeId(scope)) {
            console.error(
                '[getMarketSummaryClientAction] unknown scope:',
                scope
            );
            return { ok: false, error: 'server_error' };
        }
        const resolved = dashboardScopeOf(scope);
        const summary = await getCachedMarketSummary(
            marketDataProviderFor(resolved.id),
            resolved
        );
        if (isE2E()) {
            const stub = await import('@/shared/api/e2eMarketStub');
            const forcePartial = (await cookies()).get(
                stub.E2E_FORCE_MARKET_PARTIAL_COOKIE
            );
            return {
                summary: forcePartial
                    ? stub.e2eForceMarketPartial(summary)
                    : summary,
            };
        }
        return { summary };
    } catch (e) {
        console.error('[getMarketSummaryClientAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
