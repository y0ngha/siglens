'use server';

import type { MarketSummaryActionResult } from '@/shared/lib/types';
import { isBot } from '@/shared/api/isBot';
import { submitBriefing } from '@y0ngha/siglens-core';
import { cookies, headers } from 'next/headers';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { isE2E } from '@/shared/api/e2eEnv';
import { getCachedMarketSummary } from '../lib/marketSummaryCache';

export async function getMarketSummaryAction(): Promise<MarketSummaryActionResult> {
    try {
        const requestHeaders = await headers();
        const provider = getMarketDataProvider();
        const summary = await getCachedMarketSummary(provider);

        if (isBot(requestHeaders)) {
            return { summary, briefing: null, botBlocked: true };
        }

        if (isE2E()) {
            // market 스펙이 설정하는 force-partial 쿠키가 있으면 일부 quote를 0으로
            // 만들어 "데이터 일부 로드 실패" 안내를 결정적으로 검증한다. 스텁 + 헬퍼는
            // E2E 가드 안 동적 import로 lazy chunk에 둔다(prod main 번들 제외).
            const stub = await import('@/shared/api/e2eMarketStub');
            const forcePartial = (await cookies()).get(
                stub.E2E_FORCE_MARKET_PARTIAL_COOKIE
            );
            return {
                summary: forcePartial
                    ? stub.e2eForceMarketPartial(summary)
                    : summary,
                briefing: null,
                botBlocked: false,
            };
        }

        let briefing = null;
        try {
            briefing = await submitBriefing(summary);
        } catch (briefingError) {
            console.error(
                '[getMarketSummaryAction] briefing submission failed:',
                briefingError
            );
        }
        return { summary, briefing, botBlocked: false };
    } catch (e) {
        console.error('[getMarketSummaryAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
