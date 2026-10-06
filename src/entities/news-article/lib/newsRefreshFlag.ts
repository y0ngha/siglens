import 'server-only';
import { createRedisFlag } from '@/shared/cache/createRedisFlag';
import { getRedisClient } from '@/shared/cache/redisClient';
import { SECONDS_PER_MINUTE } from '@/shared/config/time';

const NEWS_REFRESH_FLAG_TTL_MINUTES = 10;

/** 뉴스 refresh 플래그 TTL — 이 시간 내 재크롤링(봇)은 FMP fetch+upsert를 스킵. */
export const NEWS_REFRESH_FLAG_TTL_SECONDS =
    NEWS_REFRESH_FLAG_TTL_MINUTES * SECONDS_PER_MINUTE;

function refreshKey(symbol: string): string {
    return `news:refresh:${symbol.toUpperCase()}`;
}

const _flag = createRedisFlag(
    refreshKey,
    NEWS_REFRESH_FLAG_TTL_SECONDS,
    '[newsRefreshFlag]'
);

/** 최근(TTL 내) 이 symbol의 뉴스를 fetch했는지. Redis 미설정/장애 시 false(=항상 fetch). */
export const isRecentlyFetched = _flag.isSet;

/** 이 symbol을 "최근 fetch함"으로 표시. Redis 미설정/장애 시 noop. */
export const markFetched = _flag.mark;

/**
 * 이 symbol의 refresh를 **원자적으로** 선점한다(`SET NX EX`). 이미 TTL 안이면 `false`.
 *
 * {@link isRecentlyFetched} → (작업) → {@link markFetched}는 GET 뒤에 SET이 와서, 같은
 * 순간 들어온 방문자들이 모두 "아직 안 함"을 읽고 FMP 적재와 카드 분석을 중복으로
 * 돌렸다(감사 L1). 공개 액션의 진입 가드는 이걸 쓴다. 적재가 끝나면 `markFetched`가
 * 같은 키를 다시 써 TTL을 적재 완료 시점부터 다시 센다.
 *
 * Redis 미설정/장애 시 `true`(=항상 진행) — 기존 `isRecentlyFetched`의 강등과 같다.
 */
export async function tryClaimNewsRefresh(symbol: string): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return true;
    try {
        const claimed = await redis.set(refreshKey(symbol), '1', {
            nx: true,
            ex: NEWS_REFRESH_FLAG_TTL_SECONDS,
        });
        return claimed !== null;
    } catch (error) {
        console.error('[newsRefreshFlag] claim failed', error);
        return true;
    }
}

/**
 * 적재가 실패한 뒤 재시도를 막는 시간. 10분 전체를 막으면 FMP 일시 장애·DB 쓰기
 * 실패 한 번으로 그 심볼의 뉴스가 10분간 갱신되지 않는다. 그렇다고 바로 풀면 유료
 * API가 429/402로 거절하는 동안 마운트마다 재요청이 반복된다(`ingestNewsForSymbol`이
 * FMP 왕복 **전에** 표시하는 이유). 그 사이를 짧은 간격으로 둔다.
 */
export const NEWS_REFRESH_RETRY_TTL_SECONDS = 2 * SECONDS_PER_MINUTE;

/**
 * 실패한 refresh의 선점을 짧은 재시도 간격으로 줄인다(키가 있을 때만, `SET XX EX`).
 * {@link tryClaimNewsRefresh}로 잡은 10분 창을 실패 경로에서 그대로 두지 않기 위해
 * 쓴다. Redis 미설정/장애 시 noop — 던지지 않는다.
 */
export async function shortenNewsRefreshClaim(symbol: string): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(refreshKey(symbol), '1', {
            xx: true,
            ex: NEWS_REFRESH_RETRY_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[newsRefreshFlag] shorten failed', error);
    }
}
