import 'server-only';
import { unstable_cache } from 'next/cache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import {
    getCachedMarketFearGreed,
    MARKET_FEAR_GREED_CONFIG_FINGERPRINT,
} from './marketFearGreedCache';
import type { MarketFearGreedView } from '../model';

/**
 * ISR-safe market Fear & Greed reading. Wraps the Redis layer in the Next data
 * cache so static generation is not blocked by the underlying `no-store` FMP
 * fetches. `revalidate` is 1h — the inputs are end-of-day closes, so the value
 * changes once per session and an hour bounds how long a fresh close waits.
 *
 * Its own `market:fear-greed` tag, separate from `market:summary` and
 * `sector:signals`, so revalidating one surface does not blow away the others.
 */
export function getMarketFearGreedStatic(): Promise<MarketFearGreedView> {
    return unstable_cache(
        () => getCachedMarketFearGreed(),
        ['market-fear-greed-static', MARKET_FEAR_GREED_CONFIG_FINGERPRINT],
        { revalidate: SECONDS_PER_HOUR, tags: ['market:fear-greed'] }
    )();
}
