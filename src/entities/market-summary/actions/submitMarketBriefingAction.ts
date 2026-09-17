'use server';

import type { MarketBriefingActionResult } from '@/shared/lib/types';
import { runBriefing } from '@y0ngha/siglens-core';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';
import { getCachedMarketSummary } from '../api/marketSummaryCache';
import { marketBriefingContextOf } from '../lib/marketBriefingContext';
import {
    dashboardScopeOf,
    isDashboardScopeId,
} from '@/shared/config/dashboardScope';

/**
 * briefing 클라 트리거. runBriefing(내부에서 summary 재조회 — redis HIT)의
 * cached/done 결과를 반환한다.
 *
 * **User-Agent로 가르지 않는다**(2026-09-17 운영 렌더 감사). 예전엔 봇이면
 * `botBlocked`를 돌려줬는데, Googlebot WRS가 `/market`·`/market/kr`을 렌더하면
 * 캐시가 이미 채워져 있어도 브리핑 대신 "봇 트래픽으로 보여…" 안내문이 색인됐다
 * (사람 UA로는 같은 시각 같은 페이지에 산문 400자가 나왔다). SSR peek seed는
 * 시간 버킷 키라 사람이 그 시간에 먼저 오지 않으면 비어 있어 막아 주지 못했다.
 *
 * 비용 근거: 생성은 core 캐시 키(시각 버킷 + 모델 + 입력 해시)당 한 번으로 접히고,
 * 이 경로는 JS를 실행하는 렌더러만 부른다. 사람 경로에도 rate-limit이 없으므로
 * 봇 차단이 막아 주던 남용도 없다.
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
        return { briefing, scope: resolved.id };
    } catch (e) {
        console.error('[submitMarketBriefingAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
