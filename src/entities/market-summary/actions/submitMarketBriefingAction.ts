'use server';

import type { MarketBriefingActionResult } from '@/shared/lib/types';
import { isBot } from '@/shared/api/isBot';
import { runBriefing } from '@y0ngha/siglens-core';
import { headers } from 'next/headers';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';
import { getCachedMarketSummary } from '../api/marketSummaryCache';
import { marketBriefingContextOf } from '../lib/marketBriefingContext';
import {
    dashboardScopeOf,
    isDashboardScopeId,
} from '@/shared/config/dashboardScope';

/**
 * briefing 클라 트리거. 봇이면 차단(job 미제출), 아니면 runBriefing(내부에서
 * summary 재조회 — redis HIT). cached/submitted 결과를 반환. headers()는 클라 호출
 * 경로라 ISR과 무관.
 */
/**
 * 롤링 배포 호환 기본값.
 *
 * ASG 갱신은 구·신 인스턴스를 최대 30분 함께 띄우고, Next의 Server Action id는
 * 파일 경로 + export 이름에서 나오므로 **옛 번들이 보낸 인자 없는 호출이 새 구현에
 * 그대로 도달한다.** 기본값이 없으면 그 호출이 `server_error`가 되어 `/market`에
 * 빨간 오류 배너가 뜬다 — 배포 중 30분 동안, 사이트에서 가장 트래픽이 많은 페이지에서.
 * 한 릴리스 뒤에 기본값을 떼고 필수 인자로 좁힌다.
 */
export async function submitMarketBriefingAction(
    scope: string = 'us',
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
        const summary = await getCachedMarketSummary(
            marketDataProviderFor(resolved.id),
            resolved
        );
        // context는 캐시 키에 접혀 들어간다 — peek 경로와 **같은 헬퍼**로 조립해야
        // 두 키가 일치한다(marketBriefingContextOf JSDoc).
        const briefing = await runBriefing(
            summary,
            marketBriefingContextOf(resolved, summary),
            { signal }
        );
        return { briefing, botBlocked: false, scope: resolved.id };
    } catch (e) {
        console.error('[submitMarketBriefingAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
