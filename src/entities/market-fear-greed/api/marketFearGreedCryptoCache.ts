import 'server-only';
import { cache } from 'react';
import {
    computeCryptoFearGreedHistory,
    computeCryptoFearGreedIndex,
    CRYPTO_SESSION,
} from '@y0ngha/siglens-core';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { secondsUntilSessionRoll } from '@/shared/lib/marketSessionDate';
import { buildCalendarDayComparisons } from '../lib/buildMarketFearGreedComparisons';
import { hasSnapshot } from '../lib/hasSnapshot';
import {
    cryptoLookbackStartDate,
    lastClosedUtcDate,
} from '../lib/marketFearGreedWindows';
import { sessionKeyedTtlSeconds } from '../lib/sessionKeyedTtl';
import {
    MARKET_FEAR_GREED_CRYPTO_BENCHMARK,
    MARKET_FEAR_GREED_CRYPTO_LOOKBACK_DAYS,
    MARKET_FEAR_GREED_CRYPTO_SAFE_HAVEN,
    MARKET_FEAR_GREED_CRYPTO_UNIVERSE,
} from '../lib/marketFearGreedCryptoSymbols';
import type { MarketFearGreedCryptoView } from '../model';
import { fetchCryptoDailyBars } from './fetchCryptoDailyBars';

/**
 * 티커 표 fingerprint를 캐시 키에 박아, 유니버스를 바꾸면 옛 판독값이 TTL까지
 * 서빙되지 않고 무효화되게 한다. 미국·한국판과 같은 규약.
 */
export const MARKET_FEAR_GREED_CRYPTO_CONFIG_FINGERPRINT =
    createCacheConfigFingerprint(
        JSON.stringify({
            benchmark: MARKET_FEAR_GREED_CRYPTO_BENCHMARK,
            safeHaven: MARKET_FEAR_GREED_CRYPTO_SAFE_HAVEN,
            universe: MARKET_FEAR_GREED_CRYPTO_UNIVERSE,
            lookbackDays: MARKET_FEAR_GREED_CRYPTO_LOOKBACK_DAYS,
            priceSource: 'eod-full:close,volume',
        })
    );

const CACHE_KEY = `market:fear-greed:crypto:${MARKET_FEAR_GREED_CRYPTO_CONFIG_FINGERPRINT}`;

/**
 * 21개 시리즈(BTC + 금 + 유니버스 19)를 받아 페이지가 그리는 형태로 줄인다.
 *
 * 21번의 FMP 호출은 마감일(`to`) 키 Redis 캐시 뒤에 있어 UTC 하루에 한 번이다(FMP가
 * 어제 봉을 늦게 내면 1시간 간격으로 몇 번 더). 미국판 `getMarketSummary`(11+)와 같은
 * `Promise.all` 규모라 청크 분할 이득이 없다.
 */
async function buildView(now: Date): Promise<MarketFearGreedCryptoView> {
    const from = cryptoLookbackStartDate(now);
    const to = lastClosedUtcDate(now);

    const [benchmark, safeHaven, universeBars] = await Promise.all([
        fetchCryptoDailyBars(MARKET_FEAR_GREED_CRYPTO_BENCHMARK, from, to),
        fetchCryptoDailyBars(MARKET_FEAR_GREED_CRYPTO_SAFE_HAVEN, from, to),
        Promise.all(
            MARKET_FEAR_GREED_CRYPTO_UNIVERSE.map(symbol =>
                fetchCryptoDailyBars(symbol, from, to)
            )
        ),
    ]);

    const input = {
        benchmark,
        safeHaven: safeHaven.map(({ date, close }) => ({ date, close })),
        universe: Object.fromEntries(
            MARKET_FEAR_GREED_CRYPTO_UNIVERSE.map((symbol, i) => [
                symbol,
                universeBars[i],
            ])
        ),
    };

    return {
        snapshot: computeCryptoFearGreedIndex(input),
        comparisons: buildCalendarDayComparisons(
            computeCryptoFearGreedHistory(input)
        ),
    };
}

/**
 * 암호화폐 시장 공포·탐욕 판독값 — `React.cache` → Redis → FMP.
 *
 * Redis 키에 마지막으로 닫힌 UTC 일(`to`)을 넣는다. 판독값은 `to`까지의 일봉만으로
 * 정해지므로 하루에 한 번 받고 다음 UTC 자정까지 둔다(`sessionKeyedTtlSeconds`). 미국판과
 * 같은 이유로 `computeBarsEffectiveTtl`은 쓰지 않는다.
 *
 * FMP 호출이 하나라도 실패하면 `Promise.all`에서 그대로 던진다. 유니버스가 일부만
 * 채워지면 폭·알트시즌 요인의 의미가 조용히 바뀌고, `getOrSetCache`는 fetcher가
 * 던지면 아무것도 쓰지 않는다.
 */
export const getCachedMarketFearGreedCrypto = cache(
    (): Promise<MarketFearGreedCryptoView> => {
        const now = new Date();
        const to = lastClosedUtcDate(now);
        return getOrSetCache(
            `${CACHE_KEY}:${to}`,
            view =>
                sessionKeyedTtlSeconds(
                    view,
                    to,
                    secondsUntilSessionRoll(CRYPTO_SESSION, now)
                ),
            () => buildView(now),
            hasSnapshot
        );
    }
);
