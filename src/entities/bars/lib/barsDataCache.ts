import 'server-only';
import { cache } from 'react';
import { Redis } from '@upstash/redis';
import {
    type BarsData,
    type MarketDataProvider,
    type Timeframe,
    fetchBarsWithIndicators,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';

// Redis 미설정 환경(로컬 dev 등)에서도 graceful fallback이 가능하도록 연결을 lazy 초기화로 지연한다.
let cachedRedis: Redis | null | undefined;

function getRedis(): Redis | null {
    if (cachedRedis !== undefined) return cachedRedis;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
        cachedRedis = null;
        return null;
    }
    cachedRedis = new Redis({ url, token });
    return cachedRedis;
}

/** fmpSymbol이 OHLCV 결과를 바꾸므로(예: '^SPX' vs 'SPX') 키에 포함. */
function buildBarsKey(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): string {
    const suffix = fmpSymbol ? `:${fmpSymbol.toUpperCase()}` : '';
    return `bars:${symbol.toUpperCase()}:${timeframe}${suffix}`;
}

/**
 * OHLCV+지표를 cache→FMP로 가져온다.
 *
 * 캐시 레이어:
 *   1. React.cache — 요청 내 dedup(layout/page가 같은 TF prefetch 시 1회).
 *   2. Upstash Redis — cross-request, 시장 세션별 TTL(core `computeBarsEffectiveTtl`).
 *      봇이 한 종목의 여러 탭을 연속 크롤링해도 fetch가 1회로 수렴.
 *      Redis 미설정 시 graceful fallback으로 FMP 직접 호출.
 *
 * 에러는 캐시하지 않는다(throw가 set 이전에 전파). 빈 봉도 캐시하지 않는다
 * (transient 장애를 TTL 동안 굳히지 않도록 — optionsDataCache의 null-caution과 동일).
 */
export const getCachedBarsWithIndicators = cache(
    async (
        provider: MarketDataProvider,
        symbol: string,
        timeframe: Timeframe,
        fmpSymbol?: string
    ): Promise<BarsData> => {
        const key = buildBarsKey(symbol, timeframe, fmpSymbol);
        const redis = getRedis();
        if (redis !== null) {
            try {
                const hit = await redis.get<BarsData>(key);
                if (hit !== null) return hit;
            } catch (error) {
                console.error(
                    '[barsDataCache] Redis get failed for',
                    key,
                    error
                );
            }
        }

        const fresh = await fetchBarsWithIndicators(
            provider,
            symbol,
            timeframe,
            fmpSymbol
        );

        if (fresh.bars.length > 0 && redis !== null) {
            try {
                await redis.set(key, fresh, {
                    ex: computeBarsEffectiveTtl(timeframe, new Date()),
                });
            } catch (error) {
                console.error(
                    '[barsDataCache] Redis set failed for',
                    key,
                    error
                );
            }
        }
        return fresh;
    }
);
