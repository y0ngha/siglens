import { SECONDS_PER_DAY } from '@/shared/config/time';
import { getRedisClient } from '@/shared/cache/redisClient';

/**
 * 빈 earnings 응답 마커 TTL. staleness gate(24h)와 동일하게 두어 데이터 유무와 무관하게
 * 심볼당 하루 최대 1회만 FMP를 조회하도록 통일한다.
 */
export const EARNINGS_EMPTY_MARKER_TTL_SECONDS = SECONDS_PER_DAY;

function earningsEmptyMarkerKey(symbol: string): string {
    return `earnings:empty:${symbol.toUpperCase()}`;
}

/**
 * earnings 데이터가 없는 것으로 최근(TTL 내) 확인된 심볼인지 여부.
 *
 * ETF·지수·잘못된 심볼은 FMP가 빈 응답을 주어 `earningsReports` 테이블에 레코드가
 * 생기지 않는다 → `getLatestFetchedAt`이 항상 `null` → staleness가 항상 stale로 판정되어
 * 매 요청 FMP를 호출하는 영구 cache-miss 루프가 발생한다(#567). 이 마커가 있으면 TTL 동안
 * FMP 재호출을 건너뛴다. Redis 미설정/장애 시 `false`로 degrade(기존 동작대로 fetch).
 */
export async function isEarningsKnownEmpty(symbol: string): Promise<boolean> {
    const redis = getRedisClient();
    if (redis === null) return false;
    try {
        return (await redis.get(earningsEmptyMarkerKey(symbol))) !== null;
    } catch (error) {
        console.error('[isEarningsKnownEmpty] redis get failed:', error);
        return false;
    }
}

/**
 * 심볼을 "earnings 없음"으로 `EARNINGS_EMPTY_MARKER_TTL_SECONDS` 동안 마킹.
 * Redis 미설정/장애 시 no-op(throw하지 않음).
 */
export async function markEarningsEmpty(symbol: string): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(earningsEmptyMarkerKey(symbol), 1, {
            ex: EARNINGS_EMPTY_MARKER_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[markEarningsEmpty] redis set failed:', error);
    }
}
