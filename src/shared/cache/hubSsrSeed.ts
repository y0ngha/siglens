import 'server-only';
import { getRedisClient } from './redisClient';

/**
 * 허브 브리핑의 **SSR seed 보관소**.
 *
 * ## 왜 따로 두는가
 *
 * core의 브리핑 캐시 키는 입력(시세 스냅샷)에서 파생된다. 시세가 갱신되면 키가 바뀌므로,
 * 프리웜이 쓴 값을 나중에 페이지가 같은 키로 다시 읽을 보장이 없다 — 2026-09-18 실측에서
 * 크론이 14:45에 생성하고 되읽기까지 성공했는데 15:00의 같은 경로 peek은 miss였다.
 * 읽는 쪽(`getMarketSummaryStatic`, 1h `unstable_cache`)과 쓰는 쪽(`getCachedMarketSummary`,
 * Redis TTL)이 서로 다른 스냅샷을 보기까지 한다.
 *
 * 그래서 프리웜이 **확인한 본문 자체**를 표면 단위의 고정 키에 한 벌 더 둔다. 생성 경로는
 * 계속 최신 입력을 쓰고(품질 유지), 정적 peek이 core miss일 때 이 값을 SSR seed로 쓴다.
 *
 * 뉴스 다이제스트는 입력이 DB 행 목록이라 분 단위로 안 움직여 이 문제가 없다 — 대상이
 * 브리핑 셋뿐인 이유다.
 */

/**
 * TTL이 **유일한 신선도 방어선**이다.
 *
 * seed에는 생성 시각이 없다 — core의 `MarketBriefingResponse`·`MacroBriefingResponse`에
 * 그런 필드가 없고, seed 경로의 소비자도 `generatedAt: ''`로 넘긴다(`useMarketBriefing`).
 * `BriefingCard`는 그 값이 falsy면 시각 행을 아예 숨기므로, seed로 그려진 브리핑은
 * **나이를 드러내지 않는다**. 이는 기존 core peek 경로와 같은 동작이지만, 그쪽은 core
 * 캐시 TTL이 짧게 잡아 주는 반면 여기는 이 상수 하나가 전부다.
 *
 * 그래서 크론 창 사이 최대 공백(09:55→20:30 UTC ≈ 10시간 35분, `docs/reference/CRON.md`)
 * 바로 위로만 잡는다. 12h면 그 공백을 덮으면서 최악 노출을 반나절로 묶는다. 더 늘리면
 * 시각 표시도 없는 하루 지난 시황이 색인될 수 있고, 더 줄이면 정상 운영 중에도 공백에서
 * seed가 만료돼 페이지가 다시 빈다.
 */
const SEED_TTL_SECONDS = 12 * 60 * 60;

const KEY_PREFIX = 'hub-ssr-seed';

export type HubSeedSurface = `market-briefing:${string}` | 'macro-briefing';

function keyFor(surface: HubSeedSurface): string {
    return `${KEY_PREFIX}:${surface}`;
}

/**
 * seed를 읽는다. Redis 미설정·장애·미보관은 전부 `null` — 호출부는 플레이스홀더로 떨어진다.
 */
export async function readHubSsrSeed<T>(
    surface: HubSeedSurface
): Promise<T | null> {
    const redis = getRedisClient();
    if (redis === null) return null;
    try {
        return (await redis.get<T>(keyFor(surface))) ?? null;
    } catch (error) {
        console.error(`[hub-ssr-seed] read failed: ${surface}`, error);
        return null;
    }
}

/**
 * seed를 쓴다. 실패는 삼킨다 — 프리웜의 본업(생성·무효화)을 이 부가 저장이 막으면 안 된다.
 */
export async function writeHubSsrSeed(
    surface: HubSeedSurface,
    value: unknown
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(keyFor(surface), value, { ex: SEED_TTL_SECONDS });
    } catch (error) {
        console.error(`[hub-ssr-seed] write failed: ${surface}`, error);
    }
}
