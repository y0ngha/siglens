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
import { hasSnapshot } from '../lib/hasSnapshot';
import {
    lastPublishedSessionDate,
    lookbackStartDate,
} from '../lib/marketFearGreedWindows';
import {
    MARKET_FEAR_GREED_LOOKBACK_DAYS,
    MARKET_FEAR_GREED_SERIES,
    MARKET_FEAR_GREED_SYMBOLS,
} from '../lib/marketFearGreedSymbols';
import { sessionKeyedTtlSeconds } from '../lib/sessionKeyedTtl';
import type { MarketFearGreedView } from '../model';
import { fetchDailyCloses } from './fetchDailyCloses';

/**
 * 티커 표 fingerprint를 캐시 키에 박아, 대체 ETF를 갈아끼우면 옛 판독값이 그대로
 * 서빙되지 않고 무효화되게 한다. 다른 시장 캐시와 같은 규약이다. 정적 캐시가 같은 상수를
 * 가져가므로 두 계층의 직렬화 형식이 어긋날 수 없다.
 *
 * 옛 fingerprint 키는 자기 TTL로 만료되게 둔다 — 설정 변경은 배포와 함께 나가므로 쌓이는
 * 양은 무시할 만하다.
 *
 * `priceSource`도 포함한다: 미조정 종가에서 배당 조정 종가로 전환하면(ETF는 `adjClose`,
 * `^` 지수 심볼은 `light`의 `price` — `fetchDailyCloses` 참고) 옛 배당 왜곡 시리즈로 만든
 * 판독값이 TTL까지 서빙되지 않고 무효화되어야 한다.
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
 * 여섯 시리즈를 받아 페이지가 그리는 형태로 줄인다.
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

    // safe: `series`는 core의 `MARKET_FEAR_GREED_SERIES_KEYS`에서 파생된
    // `MARKET_FEAR_GREED_SERIES`를 map한 것이라 Record의 모든 키가 정확히 한 번씩
    // 들어간다. `Object.fromEntries`가 반환 타입에서 그 사실을 잃을 뿐이다.
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

/**
 * 미국 시장 공포·탐욕 판독값 — `React.cache` → Redis → FMP.
 *
 * Redis 키에 마지막 발행 세션 날짜(`to`)를 넣는다. 판독값은 `to`까지의 종가만으로 정해지므로
 * 세션당 한 번 받고 `to`가 넘어갈 때까지 둔다(`sessionKeyedTtlSeconds`). `computeBarsEffectiveTtl`은
 * 일부러 쓰지 않는다: 그 함수는 "다음 개장까지"로 상한을 잡는데 종가는 마감 **뒤에야** 들어오므로,
 * 마감 뒤 판독값이 다음 세션 키 아래 놓이는 날짜 키 방식이 그 문제를 푼다.
 *
 * FMP 호출이 하나라도 실패하면 빈 시리즈로 degrade하지 않고 `Promise.all`에서 그대로 던진다
 * — 바스켓이 일부만 채워지면 점수의 의미가 조용히 바뀌고, `getOrSetCache`는 fetcher가 던지면
 * 아무것도 쓰지 않는다.
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
