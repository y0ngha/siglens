import 'server-only';
import { cache } from 'react';
import {
    computeMarketFearGreedHistory,
    computeMarketFearGreedIndex,
    type MarketFearGreedInput,
} from '@y0ngha/siglens-core';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { buildMarketFearGreedComparisons } from '../lib/buildMarketFearGreedComparisons';
import {
    fetchDailyCloses,
    lastPublishedSessionDate,
    lookbackStartDate,
} from '../lib/fetchDailyCloses';
import {
    MARKET_FEAR_GREED_LOOKBACK_DAYS,
    MARKET_FEAR_GREED_SERIES,
    MARKET_FEAR_GREED_SYMBOLS,
} from '../lib/marketFearGreedSymbols';
import type { MarketFearGreedView } from '../model';

/**
 * Ticker-table fingerprint baked into the cache key so swapping a proxy ETF
 * invalidates the old reading instead of serving a score computed from a
 * different basket. The static cache imports this same constant, so the two
 * layers can never disagree about the serialisation format.
 *
 * Old fingerprint keys are left to expire on their own TTL — config changes
 * ship with a deploy, so accumulation is negligible.
 */
export const MARKET_FEAR_GREED_CONFIG_FINGERPRINT =
    createCacheConfigFingerprint(
        JSON.stringify({
            symbols: MARKET_FEAR_GREED_SYMBOLS,
            lookbackDays: MARKET_FEAR_GREED_LOOKBACK_DAYS,
        })
    );

const MARKET_FEAR_GREED_CACHE_KEY = `market:fear-greed:${MARKET_FEAR_GREED_CONFIG_FINGERPRINT}`;

/**
 * Flat one-hour TTL, matching the ISR `revalidate` in front of it.
 *
 * Deliberately NOT `computeBarsEffectiveTtl`: that policy caps at "time until
 * the next open", which after a Friday close would pin this reading for a full
 * day — and the EOD closes this index consumes only land *after* the close, so
 * the entry cached at 16:05 ET is exactly the one that must not survive. A flat
 * hour bounds staleness to ~2h (Redis hour + ISR hour) at 144 FMP calls a day.
 */
const MARKET_FEAR_GREED_TTL_SECONDS = SECONDS_PER_HOUR;

/**
 * Fetch all six series and reduce them to what the page renders.
 *
 * MISTAKES §0.8 검토: 이 레포에는 `FETCH_CONCURRENCY` 상수가 없고, 가장 가까운
 * 동시성 정책은 peer 페이지들의 `Promise.all` 패턴이다 — `getMarketSummary`(지수 +
 * 섹터 ETF, 통상 11+), `economySnapshotCache`(11), financials(6)이 모두 같은 모양으로
 * production에서 돌고 있다. 여기는 6개이고 1시간 Redis 캐시 뒤에 있어 cold-gen 시
 * 시간당 6 calls — FMP 분당 한도 대비 무시 가능하다. `fetchInChunks` 분할 이득이 없다.
 */
async function buildMarketFearGreedView(
    now: Date
): Promise<MarketFearGreedView> {
    const from = lookbackStartDate(now);
    const to = lastPublishedSessionDate(now);

    const series = await Promise.all(
        MARKET_FEAR_GREED_SERIES.map(async ({ key, symbol }) => ({
            key,
            closes: await fetchDailyCloses(symbol, from, to),
        }))
    );

    // safe: `series` is built by mapping MARKET_FEAR_GREED_SERIES, which is
    // itself derived from core's MARKET_FEAR_GREED_SERIES_KEYS — so every key of
    // the Record is present exactly once. `Object.fromEntries` just loses that
    // in its return type.
    const input = Object.fromEntries(
        series.map(({ key, closes }) => [key, closes])
    ) as MarketFearGreedInput;

    return {
        snapshot: computeMarketFearGreedIndex(input),
        comparisons: buildMarketFearGreedComparisons(
            computeMarketFearGreedHistory(input)
        ),
    };
}

/** A view without a snapshot means insufficient data — never freeze that in the cache. */
function hasSnapshot(view: MarketFearGreedView): boolean {
    return view.snapshot !== null;
}

/**
 * Market-wide Fear & Greed reading, via `React.cache` → Redis → FMP.
 *
 * A failed FMP call throws out of `Promise.all` rather than degrading to an
 * empty series — a partial basket would silently change what the score means,
 * and `getOrSetCache` never writes when the fetcher throws.
 */
export const getCachedMarketFearGreed = cache(
    (): Promise<MarketFearGreedView> =>
        getOrSetCache(
            MARKET_FEAR_GREED_CACHE_KEY,
            MARKET_FEAR_GREED_TTL_SECONDS,
            () => buildMarketFearGreedView(new Date()),
            hasSnapshot
        )
);
