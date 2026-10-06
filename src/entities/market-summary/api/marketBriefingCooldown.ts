import 'server-only';
import { createRedisSlot } from '@/shared/cache/createRedisSlot';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';

/**
 * 시장 브리핑의 생성 간격(1시간, 시장별) — 크론과 방문자 경로가 **같은 키**를 공유한다.
 *
 * 브리핑의 core 캐시 키는 시세 요약(`MarketSummaryData`)에서 파생된다. 장이 열려 있는
 * 동안은 요약이 갱신될 때마다(미국 1분·한국 5분) 키가 갈리고, 키가 갈릴 때마다 LLM 호출이
 * 한 번씩 나갔다 — 크론은 tick마다, 방문자 경로는 거의 매분(2026-10 비용 감사). 페이지
 * ISR이 1시간이라 그보다 자주 만들어도 화면에는 시간당 한 벌만 나간다.
 *
 * 한 키를 두 경로가 함께 쓰므로 어느 쪽이 먼저 잡든 다른 쪽은 그 시간 동안 새로
 * 만들지 않는다. 키 철자는 이 모듈로 옮기기 전 크론(`hub-prewarm`)이 쓰던 것 그대로다 —
 * 배포 순간 이미 서 있던 쿨다운이 이어진다.
 */
const MARKET_BRIEFING_COOLDOWN_SECONDS = SECONDS_PER_HOUR;

const LOG_PREFIX = '[market-briefing-cooldown]';

function cooldownKey(scopeId: DashboardScopeId): string {
    return `hub-prewarm:market-briefing-cooldown:${scopeId}`;
}

/**
 * 크론과 방문자가 함께 쓰는 생성 슬롯 — 둘 다 생성 **전에** `SET NX`로 잡아 한 명만
 * 통과시킨다(확인과 표시를 가르면 그 사이 생성 동안 다른 쪽이 또 만든다). Redis를 쓸 수
 * 없으면 fail-open(생성 허용)이다(`createRedisSlot`).
 */
const marketBriefingSlot = createRedisSlot(
    cooldownKey,
    MARKET_BRIEFING_COOLDOWN_SECONDS,
    LOG_PREFIX
);

/**
 * 이번 시간의 생성 슬롯을 잡는다.
 *
 * @returns 슬롯을 잡았으면 true. 이미 누군가(크론 포함) 이번 시간에 만들었으면 false.
 */
export function tryAcquireMarketBriefingSlot(
    scopeId: DashboardScopeId
): Promise<boolean> {
    return marketBriefingSlot.tryAcquire(scopeId);
}

/**
 * 생성(LLM 호출)이 실패했을 때 슬롯을 돌려준다 — 남겨 두면 한 시간 동안 아무도 다시
 * 시도하지 않고, 돌려줄 브리핑도 없는 방문자가 플레이스홀더만 본다. 생성이 끝난 뒤의
 * 실패(크론 되읽기 등)에는 부르지 않는다 — 비용은 이미 나갔다.
 */
export function releaseMarketBriefingSlot(
    scopeId: DashboardScopeId
): Promise<void> {
    return marketBriefingSlot.release(scopeId);
}
