import 'server-only';
import { cache } from 'react';
import {
    computeMarketFearGreedHistory,
    computeMarketFearGreedIndex,
    type MarketFearGreedInput,
    US_EQUITY_SESSION,
} from '@y0ngha/siglens-core';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { secondsUntilSessionRoll } from '@/shared/lib/marketSessionDate';
import { buildMarketFearGreedComparisons } from '../lib/buildMarketFearGreedComparisons';
import { sessionKeyedTtlSeconds } from '../lib/sessionKeyedTtl';
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
 *
 * `priceSource` is included so switching from unadjusted to dividend-adjusted
 * closes (see `fetchDailyCloses` — ETFs read `adjClose`, `^` index symbols keep
 * `light`'s `price`) invalidates readings computed from the old,
 * dividend-distorted series instead of serving them until TTL.
 */
export const MARKET_FEAR_GREED_CONFIG_FINGERPRINT =
    createCacheConfigFingerprint(
        JSON.stringify({
            symbols: MARKET_FEAR_GREED_SYMBOLS,
            lookbackDays: MARKET_FEAR_GREED_LOOKBACK_DAYS,
            priceSource: 'etf:adjClose,index:price',
        })
    );

const MARKET_FEAR_GREED_CACHE_KEY = `market:fear-greed:${MARKET_FEAR_GREED_CONFIG_FINGERPRINT}`;

/**
 * Fetch all six series and reduce them to what the page renders.
 *
 * SERVER.md#CC-1 검토: 호출 수가 고정이라 별도 동시성 상수를 두지 않는다.
 * 동시성 정책은 peer 페이지들의 `Promise.all` 패턴이다 — `getMarketSummary`(지수 +
 * 섹터 ETF, 통상 11+), `economySnapshotCache`(11), financials(6)이 모두 같은 모양으로
 * production에서 돌고 있다. 여기는 6개이고 마감일 키 Redis 캐시 뒤에 있어 세션당
 * 한 번(발행 지연 시 1시간 간격 재시도) 6 calls — FMP 분당 한도 대비 무시 가능하다. 청크 분할 이득이 없다.
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
 * The Redis key carries the last published session date (`to`): the reading is
 * a pure function of closes up to `to`, so it is fetched once per session and
 * kept until `to` rolls (`sessionKeyedTtlSeconds`). Deliberately NOT
 * `computeBarsEffectiveTtl`: that caps at "time until the next open", and the
 * closes land only *after* the close — the dated key handles that instead, since
 * the post-close reading lives under the next session's key.
 *
 * A failed FMP call throws out of `Promise.all` rather than degrading to an
 * empty series — a partial basket would silently change what the score means,
 * and `getOrSetCache` never writes when the fetcher throws.
 */
export const getCachedMarketFearGreed = cache(
    (): Promise<MarketFearGreedView> => {
        const now = new Date();
        const to = lastPublishedSessionDate(now);
        return getOrSetCache(
            `${MARKET_FEAR_GREED_CACHE_KEY}:${to}`,
            view =>
                sessionKeyedTtlSeconds(
                    view,
                    to,
                    secondsUntilSessionRoll(US_EQUITY_SESSION, now)
                ),
            () => buildMarketFearGreedView(now),
            hasSnapshot
        );
    }
);
