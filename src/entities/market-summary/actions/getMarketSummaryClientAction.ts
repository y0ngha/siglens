'use server';

import type { MarketSummaryActionResult } from '@/shared/lib/types';
import { isE2E } from '@/shared/api/e2eEnv';
import { cookies } from 'next/headers';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { getCachedMarketSummary } from '../lib/marketSummaryCache';

/**
 * 클라(useMarketSummary) 전용 summary fetch. RSC prefetch는 getMarketSummaryStatic
 * (정적)을 쓰고, 클라는 이 action으로 redis 실시간 값을 받는다. E2E force-partial
 * 쿠키 seam을 여기에 유지한다(정적 경로는 쿠키를 못 읽으므로). 라우트 렌더가 아닌
 * 클라 호출이라 cookies() 사용이 ISR을 깨지 않는다.
 */
export async function getMarketSummaryClientAction(): Promise<MarketSummaryActionResult> {
    try {
        const summary = await getCachedMarketSummary(getMarketDataProvider());
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
