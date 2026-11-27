import 'server-only';
import { computeBarsEffectiveTtl, type Timeframe } from '@y0ngha/siglens-core';
import { sessionSpecForDashboardScope } from '@/shared/api/market/sessionSpecFor';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';

/**
 * 서버 캐시(`sectorSignalsCache`, `marketSummaryCache`)만 쓰는 대시보드 TTL 계산.
 * `sessionSpecFor.ts`는 클라이언트 번들에도 닿는데 `computeBarsEffectiveTtl`은 core 브라우저
 * 진입점에 없으므로(`coreClientExports` 가드), TTL 계산은 이 서버 전용 모듈에 둔다.
 */

/**
 * 한국 대시보드 캐시 TTL의 하한(초).
 *
 * **왜 하한이 필요한가**: `computeBarsEffectiveTtl`은 장중에 60초를 준다. 미국은
 * FMP 실시간이라 그 값이 의미가 있지만, 한국은 yahoo가 **약 20분 지연**된 시세를
 * 준다 — 60초마다 새로 긁어도 같은 숫자가 스무 번 돌아온다.
 *
 * 그 사이 비용은 실재한다. `/market/kr` 리필 1회 = 지수·ETF 시세 9회 +
 * 종목 20개 × (봉 1 + 시세 1) = **49회**. 6.5시간 장중을 60초로 나누면 timeframe
 * 하나당 하루 ~390 리필이고, timeframe이 3개라 최대 5.7만 회다. yahoo는 무인증이라
 * 늘릴 쿼터가 없고, 라이브러리 큐가 프로세스 전역 `concurrency: 4`이므로 여기서
 * 막히면 같은 프로세스의 KR 종목 페이지까지 함께 줄을 선다.
 */
const KR_MIN_CACHE_TTL_SECONDS = 300;

/**
 * scope에 맞는 대시보드 캐시 TTL(초). 세션 분기 + 한국 하한을 한 곳에서 적용한다.
 *
 * 호출부마다 `computeBarsEffectiveTtl(..., sessionSpecForDashboardScope(id))`를
 * 되풀이하면 하한을 한 곳에만 넣는 실수가 나고, 그 실수는 화면에 아무 표시도
 * 나지 않는다(요금과 429로만 드러난다).
 */
export function dashboardCacheTtlSeconds(
    scope: DashboardScopeId,
    timeframe: Timeframe,
    now: Date
): number {
    const ttl = computeBarsEffectiveTtl(
        timeframe,
        now,
        sessionSpecForDashboardScope(scope)
    );
    return scope === 'kr' ? Math.max(ttl, KR_MIN_CACHE_TTL_SECONDS) : ttl;
}
