import 'server-only';
import { cache } from 'react';
import { Redis } from '@upstash/redis';
import { YahooOptionsAdapter } from '@/infrastructure/options/YahooOptionsAdapter';
import type { OptionsSnapshot } from '@y0ngha/siglens-core';

const adapter = new YahooOptionsAdapter();

// hasOptionsMarket cross-request 캐시 TTL — 옵션 신규 상장/폐지가 즉시
// 반영될 필요는 없고, sitemap 빌드가 매 시간 ~300 ticker × Yahoo probe로
// rate-limit을 깨는 위험이 더 큼. 6시간이면 동일 sitemap window 안에서
// 단 한 번만 fetch한다 (이슈 #439 참조).
// export — 테스트가 동일 상수를 import해 silent divergence를 차단한다.
export const HAS_OPTIONS_MARKET_TTL_SECONDS = 6 * 60 * 60;

// tokenStore.ts / pendingOAuthSignupStore.ts와 같은 lazy-singleton 패턴.
let cachedRedis: Redis | null | undefined;

function getRedis(): Redis | null {
    if (cachedRedis !== undefined) return cachedRedis;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
        // Redis 미설정(로컬 dev 등)에서는 fetch 직행 — graceful fallback.
        cachedRedis = null;
        return null;
    }
    cachedRedis = new Redis({ url, token });
    return cachedRedis;
}

function buildHasOptionsKey(symbol: string): string {
    return `options:has-market:${symbol.toUpperCase()}`;
}

/**
 * 옵션 시장이 형성된 종목인지 확인한다.
 *
 * 캐시 레이어:
 *   1. React.cache — request 내 dedup (generateMetadata + page body 양쪽에서 호출 시).
 *   2. Upstash Redis — cross-request 캐시 6시간 TTL. sitemap 빌드가 같은 ticker
 *      목록을 반복 probe하지 않도록 막는다. Redis 미설정 시 graceful fallback으로
 *      Yahoo 직접 호출.
 */
export const hasOptionsMarket = cache(
    async (symbol: string): Promise<boolean> => {
        const key = buildHasOptionsKey(symbol);
        const redis = getRedis();
        if (redis !== null) {
            try {
                const cached = await redis.get<boolean>(key);
                if (cached !== null) return cached;
            } catch (error) {
                // Redis 일시 장애는 fallback으로 흡수 — 옵션 시장 데이터는 캐시 미스로
                // 충분히 복구된다. 로그만 남기고 계속 진행.
                console.error(
                    '[optionsDataCache] Redis get failed for',
                    key,
                    error
                );
            }
        }

        // Yahoo Finance API 일시 장애도 sitemap 빌드가 깨지지 않게 흡수한다.
        // 옵션 시장 정보는 보수적으로 false 처리해 sitemap에서 제외하고
        // 다음 요청에서 회복되면 자연스럽게 복원된다.
        let fresh: boolean;
        try {
            fresh = await adapter.hasOptionsMarket(symbol);
        } catch (error) {
            console.error(
                '[optionsDataCache] adapter.hasOptionsMarket failed for',
                key,
                error
            );
            return false;
        }

        if (redis !== null) {
            try {
                await redis.set(key, fresh, {
                    ex: HAS_OPTIONS_MARKET_TTL_SECONDS,
                });
            } catch (error) {
                console.error(
                    '[optionsDataCache] Redis set failed for',
                    key,
                    error
                );
            }
        }
        return fresh;
    }
);

/**
 * 종목의 전체 옵션 스냅샷(모든 만기)을 가져온다. 옵션 없는 종목이면 null.
 */
export const fetchOptionsSnapshot = cache(
    async (symbol: string): Promise<OptionsSnapshot | null> => {
        return adapter.fetchSnapshot(symbol);
    }
);
