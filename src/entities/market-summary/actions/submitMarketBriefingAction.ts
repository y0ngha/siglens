'use server';

import type { MarketBriefingActionResult } from '@/shared/lib/types';
import {
    peekBriefingCache,
    runBriefing,
    type MarketBriefingContext,
    type MarketBriefingResponse,
    type MarketSummaryData,
    type RunBriefingResult,
} from '@y0ngha/siglens-core';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';
import { getCachedMarketSummary } from '../api/marketSummaryCache';
import { marketBriefingContextOf } from '../lib/marketBriefingContext';
import {
    releaseMarketBriefingSlot,
    tryAcquireMarketBriefingSlot,
} from '../api/marketBriefingCooldown';
import {
    readLatestMarketBriefing,
    writeLatestMarketBriefing,
} from '../api/latestMarketBriefing';
import { marketBriefingSeedSurface } from '../api/briefingStaticCache';
import { readHubSsrSeed, writeHubSsrSeed } from '@/shared/cache/hubSsrSeed';
import {
    dashboardScopeOf,
    isPageDashboardScopeId,
    type DashboardScope,
} from '@/shared/config/dashboardScope';

/**
 * runBriefing을 부르고, 실제로 생성됐으면(`done`) 그 본문을 기록한다.
 *
 * `ownsSlot`은 이 호출이 생성 슬롯을 잡았는지다. 잡은 호출이 실패하면 슬롯을 돌려줘
 * 다음 방문자가 다시 시도하게 한다 — 남이 잡은 슬롯(콜드 스타트 경로)은 건드리지 않는다.
 * 예외는 그대로 올려 액션의 catch가 `server_error`로 바꾸게 한다.
 *
 * 캐시 hit 경로도 이 함수를 지난다(`ownsSlot: false`). peek 직후 시간 버킷이 넘어가
 * runBriefing이 생성으로 바뀌는 드문 경우에도 그 본문이 기록되게 하려는 것이다.
 */
async function runAndRecordBriefing(
    summary: MarketSummaryData,
    context: MarketBriefingContext,
    scope: DashboardScope,
    signal: AbortSignal | undefined,
    ownsSlot: boolean
): Promise<RunBriefingResult> {
    try {
        const result = await runBriefing(summary, context, { signal });
        if (result.status === 'done') {
            // 쿨다운에 막힌 방문자가 받을 값(`latestMarketBriefing`)과 페이지 peek가
            // 키 miss 때 물러나는 seed를 함께 최신으로 둔다 — 크론이 생성할 때와 같다.
            await Promise.all([
                writeLatestMarketBriefing(scope, {
                    briefing: result.briefing,
                    generatedAt: result.generatedAt,
                }),
                writeHubSsrSeed(
                    marketBriefingSeedSurface(scope),
                    result.briefing
                ),
            ]);
        }
        return result;
    } catch (error) {
        if (ownsSlot) await releaseMarketBriefingSlot(scope.id);
        throw error;
    }
}

/**
 * 쿨다운 중 돌려줄 이미 만든 브리핑. 마지막 생성본(시각 포함)을 먼저, 없으면 SSR seed
 * (시각 없음 — `BriefingCard`는 빈 `generatedAt`이면 시각 행을 숨긴다)를 쓴다.
 */
async function readFallbackBriefing(
    scope: DashboardScope
): Promise<RunBriefingResult | null> {
    const latest = await readLatestMarketBriefing(scope);
    if (latest !== null) {
        return {
            status: 'cached',
            briefing: latest.briefing,
            generatedAt: latest.generatedAt,
        };
    }
    const seed = await readHubSsrSeed<MarketBriefingResponse>(
        marketBriefingSeedSurface(scope)
    );
    return seed === null
        ? null
        : { status: 'cached', briefing: seed, generatedAt: '' };
}

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
 * 비용 근거: core 캐시 키(시각 버킷 + 모델 + **시세 해시**)는 장중 요약이 갱신될
 * 때마다(미국 1분·한국 5분) 갈리므로, 키당 한 번 생성만으로는 방문자가 거의 매분 LLM
 * 호출을 일으켰다(2026-10 비용 감사). 그래서 키 miss일 때는 시장별 1시간 생성 슬롯
 * (`marketBriefingCooldown` — 크론과 같은 키)을 잡은 호출만 생성하고, 못 잡은 호출은
 * 마지막 생성본(`latestMarketBriefing`) → SSR seed 순으로 이미 만든 브리핑을 돌려준다.
 * 둘 다 없을 때(배포 직후 같은 콜드 스타트)만 슬롯 없이 생성한다 — 빈 카드보다 낫고,
 * 생성되는 순간 마지막 생성본이 채워져 다음 방문자부터는 막힌다. 이 경로는 JS를
 * 실행하는 렌더러만 부르고, UA로 가르지 않으므로 봇 차단이 막아 주던 남용도 없다.
 *
 * runBriefing 결과는 `cached`|`done`뿐이라(core `RunBriefingResult`) 다이제스트처럼
 * "던지지 않았지만 생성도 안 한" 상태를 따로 슬롯 반환할 필요가 없다.
 */
export async function submitMarketBriefingAction(
    /**
     * 롤링 배포 호환 기본값.
     *
     * ASG 갱신은 구·신 인스턴스를 최대 30분 함께 띄우고, Next의 Server Action id는
     * 파일 경로 + export 이름에서 나오므로 **옛 번들이 보낸 인자 없는 호출이 새 구현에
     * 그대로 도달한다.** 기본값이 없으면 그 호출이 `server_error`가 되어 `/market`에
     * 빨간 오류 배너가 뜬다 — 배포 중 30분 동안, 사이트에서 가장 트래픽이 많은 페이지에서.
     * 한 릴리스 뒤에 기본값을 떼고 필수 인자로 좁힌다.
     */
    scope: string = 'us',
    signal?: AbortSignal
): Promise<MarketBriefingActionResult> {
    try {
        // 직렬화를 건너온 값이라 런타임에서 좁힌다.
        if (!isPageDashboardScopeId(scope)) {
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
        const context = marketBriefingContextOf(resolved, summary);
        // 캐시 hit은 생성이 아니므로 슬롯을 건드리지 않는다. 값은 runBriefing의 cached
        // 경로로 받는다 — peek는 본문만 주고 생성 시각을 주지 않는다.
        const isCached = (await peekBriefingCache(summary, context)) !== null;
        const ownsSlot =
            !isCached && (await tryAcquireMarketBriefingSlot(resolved.id));
        if (!isCached && !ownsSlot) {
            const fallback = await readFallbackBriefing(resolved);
            if (fallback !== null) {
                return { briefing: fallback, scope: resolved.id };
            }
        }
        const briefing = await runAndRecordBriefing(
            summary,
            context,
            resolved,
            signal,
            ownsSlot
        );
        return { briefing, scope: resolved.id };
    } catch (e) {
        console.error('[submitMarketBriefingAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
