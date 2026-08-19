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
/**
 * 롤링 배포 호환 기본값.
 *
 * ASG 갱신은 구·신 인스턴스를 최대 30분 함께 띄우고, Next의 Server Action id는
 * 파일 경로 + export 이름에서 나오므로 **옛 번들이 보낸 인자 없는 호출이 새 구현에
 * 그대로 도달한다.** 기본값이 없으면 그 호출이 `server_error`가 되어 `/market`에
 * 빨간 오류 배너가 뜬다 — 배포 중 30분 동안, 사이트에서 가장 트래픽이 많은 페이지에서.
 * 한 릴리스 뒤에 기본값을 떼고 필수 인자로 좁힌다.
 */
export async function getMarketSummaryClientAction(
    scope: string = 'us'
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
                scope: resolved.id,
            };
        }
        // `scope`를 되돌려 준다 — 응답이 어느 시장인지 스스로 밝혀야 롤링 배포 중
        // 구 컨테이너가 준 미국 요약을 클라가 알아챌 수 있다(타입 JSDoc 참조).
        return { summary, scope: resolved.id };
    } catch (e) {
        console.error('[getMarketSummaryClientAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
