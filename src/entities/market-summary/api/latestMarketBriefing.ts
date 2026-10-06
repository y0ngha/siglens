import 'server-only';
import type { MarketBriefingResponse } from '@y0ngha/siglens-core';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { readHubSsrSeed, writeHubSsrSeed } from '@/shared/cache/hubSsrSeed';

/** 마지막으로 **실제 생성된** 브리핑과 그 생성 시각. */
export interface LatestMarketBriefing {
    readonly briefing: MarketBriefingResponse;
    readonly generatedAt: string;
}

/**
 * 생성 쿨다운(`marketBriefingCooldown`)에 막힌 방문자에게 돌려줄 값의 키.
 *
 * SSR seed(`marketBriefingSeedSurface`)와 따로 둔다 — seed는 페이지 peek가 읽는 본문
 * 전용이라 생성 시각이 없고, 크론의 `alreadyFresh` 경로도 그 자리를 덮어쓴다. 이쪽은
 * 생성(`status: 'done'`) 순간에만 쓰므로 `generatedAt`이 그 본문의 진짜 생성 시각이다.
 * 시장별로 갈라야 하는 이유는 seed와 같다.
 */
function latestMarketBriefingSurface(scope: DashboardScope): string {
    return `market-briefing-latest:${scope.id}`;
}

/** 없거나 Redis를 쓸 수 없으면 `null`(`readHubSsrSeed`). */
export function readLatestMarketBriefing(
    scope: DashboardScope
): Promise<LatestMarketBriefing | null> {
    return readHubSsrSeed<LatestMarketBriefing>(
        latestMarketBriefingSurface(scope)
    );
}

/** 실패는 삼킨다 — 부가 저장이 생성 결과 반환을 막으면 안 된다(`writeHubSsrSeed`). */
export function writeLatestMarketBriefing(
    scope: DashboardScope,
    entry: LatestMarketBriefing
): Promise<void> {
    return writeHubSsrSeed(latestMarketBriefingSurface(scope), entry);
}
