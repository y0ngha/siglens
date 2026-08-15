import 'server-only';
import { cache } from 'react';
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
 *
 * Wrapped in `React.cache` because `generateMetadata` and the page body both
 * read this within one request, and their answers must agree: metadata decides
 * `noindex` from `snapshot === null` while the body decides which UI to render
 * from the same field. Without the in-request memo the two calls could land on
 * either side of a cache expiry and disagree — an indexable page showing the
 * empty state, or the reverse. `unstable_cache` handles cross-request
 * staticization, not in-request memoization.
 *
 * (The FMP fan-out itself is already deduped a layer down —
 * `getCachedMarketFearGreed` is `React.cache`d — so this wrapper is about
 * agreement between the two readers, not about duplicate upstream calls.)
 *
 * Same shape as `economySnapshotStaticCache`, for the same reason.
 * `/market`'s `getMarketSummaryStatic` deliberately omits it: its
 * `generateMetadata` does not read the summary, so it is called once per request.
 */
export const getMarketFearGreedStatic = cache(
    (): Promise<MarketFearGreedView> =>
        unstable_cache(
            () => getCachedMarketFearGreed(),
            ['market-fear-greed-static', MARKET_FEAR_GREED_CONFIG_FINGERPRINT],
            { revalidate: SECONDS_PER_HOUR, tags: ['market:fear-greed'] }
        )()
);
