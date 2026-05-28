import 'server-only';
import { cache } from 'react';
import { getRedisClient } from '@/shared/cache/redisClient';
import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@/shared/config/time';
import { YahooOptionsAdapter } from './YahooOptionsAdapter';
import {
    getOptionsCacheLifeProfile,
    type OptionsCacheLifeProfile,
} from './optionsCacheLife';
import type { OptionsSnapshot } from '@y0ngha/siglens-core';

const adapter = new YahooOptionsAdapter();

// hasOptionsMarket cross-request 캐시 TTL — 옵션 신규 상장/폐지가 즉시
// 반영될 필요는 없고, sitemap 빌드가 매 시간 ~300 ticker × Yahoo probe로
// rate-limit을 깨는 위험이 더 큼. 6시간이면 동일 sitemap window 안에서
// 단 한 번만 fetch한다 (이슈 #439 참조).
// export — 테스트가 동일 상수를 import해 silent divergence를 차단한다.
export const HAS_OPTIONS_MARKET_TTL_SECONDS = 6 * SECONDS_PER_HOUR;

/**
 * fetchOptionsSnapshot cross-request 캐시 TTL — 시장 시간대별로 freshness
 * trade-off가 달라 세 단계로 분리한다.
 *
 * - market-open: 활성 트레이딩 중 quote/IV/volume이 실시간으로 변동하지만 옵션
 *   페이지는 분 단위 freshness면 충분. 1분이면 인기 ticker 트래픽에서도
 *   Yahoo 호출이 분당 1회로 수렴.
 * - market-closed: 정규장 외(pre/post)는 OI snapshot이 다음 정규장 직전까지
 *   거의 변하지 않는다. 30분 캐시로 충분.
 * - weekend: 주말은 Yahoo가 갱신하지 않으므로 4시간 캐시로 호출량을 최소화.
 */
export const OPTIONS_SNAPSHOT_TTL_SECONDS: Record<
    OptionsCacheLifeProfile,
    number
> = {
    'options-market-open': SECONDS_PER_MINUTE,
    'options-market-closed': 30 * SECONDS_PER_MINUTE,
    'options-weekend': 4 * SECONDS_PER_HOUR,
};

function buildHasOptionsKey(symbol: string): string {
    return `options:has-market:${symbol.toUpperCase()}`;
}

function buildSnapshotKey(symbol: string): string {
    return `options:snapshot:${symbol.toUpperCase()}`;
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
        const redis = getRedisClient();
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
 *
 * 캐시 레이어:
 *   1. React.cache — request 내 dedup (page.tsx + Server Action 같은 요청
 *      안에서 여러 번 호출돼도 한 번만 Yahoo를 친다).
 *   2. Upstash Redis — cross-request 캐시. 시장 시간대별 TTL(`OPTIONS_SNAPSHOT_TTL_SECONDS`)
 *      을 적용해 활성 트레이딩 중에는 짧게, 주말은 길게 캐시한다. Redis 미설정 시
 *      graceful fallback으로 Yahoo 직접 호출.
 *
 * `null` 결과(옵션 없는 ticker, Yahoo 일시 장애)는 negative cache로 저장하지 않는다 —
 * Yahoo가 일시적으로 실패한 경우 TTL 동안 잘못된 'no data' 상태가 굳어버릴 위험이
 * 크기 때문. `hasOptionsMarket`은 옵션 존재 여부만 묻는 가벼운 probe라 negative
 * cache가 안전하지만, snapshot은 전체 chain을 다루므로 더 보수적으로 동작한다.
 */
export const fetchOptionsSnapshot = cache(
    async (symbol: string): Promise<OptionsSnapshot | null> => {
        const key = buildSnapshotKey(symbol);
        const redis = getRedisClient();
        if (redis !== null) {
            try {
                const cached = await redis.get<OptionsSnapshot>(key);
                if (cached !== null) return cached;
            } catch (error) {
                console.error(
                    '[optionsDataCache] Redis get failed for',
                    key,
                    error
                );
            }
        }

        const fresh = await adapter.fetchSnapshot(symbol);

        // null은 캐시하지 않음 — 위 docstring 참고.
        if (fresh !== null && redis !== null) {
            const ttl =
                OPTIONS_SNAPSHOT_TTL_SECONDS[getOptionsCacheLifeProfile()];
            try {
                await redis.set(key, fresh, { ex: ttl });
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
