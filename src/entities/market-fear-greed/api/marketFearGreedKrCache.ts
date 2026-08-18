import 'server-only';
import { cache } from 'react';
import {
    computeMarketFearGreedHistory,
    computeMarketFearGreedIndex,
    type MarketFearGreedInput,
} from '@y0ngha/siglens-core';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { lastClosedSessionDate } from '@/shared/lib/marketSessionDate';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { buildMarketFearGreedComparisons } from '../lib/buildMarketFearGreedComparisons';
import {
    fetchKrDailyCloses,
    krLookbackStartDate,
} from '../lib/fetchKrDailyCloses';
import {
    KOSPI_INDEX_SYMBOL,
    MARKET_FEAR_GREED_KR_LOOKBACK_DAYS,
    MARKET_FEAR_GREED_KR_SERIES,
    MARKET_FEAR_GREED_KR_SYMBOLS,
} from '../lib/marketFearGreedKrSymbols';
import { toRealizedVolatilitySeries } from '../lib/realizedVolatility';
import type { MarketFearGreedView } from '../model';

/**
 * 티커 테이블 fingerprint를 캐시 키에 박아, 대체 ETF를 갈아끼우면 옛 판독값이
 * 그대로 서빙되지 않고 무효화되게 한다. 미국 캐시와 같은 규약.
 *
 * 파생 변동성의 원천(`KOSPI_INDEX_SYMBOL`)도 포함해야 한다 — 그것만 바뀌어도
 * `vix` 요인이 통째로 달라지는데, 심볼 테이블에는 없어서 빠뜨리기 쉽다.
 */
export const MARKET_FEAR_GREED_KR_CONFIG_FINGERPRINT =
    createCacheConfigFingerprint(
        JSON.stringify({
            symbols: MARKET_FEAR_GREED_KR_SYMBOLS,
            volatilitySource: KOSPI_INDEX_SYMBOL,
            lookbackDays: MARKET_FEAR_GREED_KR_LOOKBACK_DAYS,
        })
    );

const CACHE_KEY = `market:fear-greed:kr:${MARKET_FEAR_GREED_KR_CONFIG_FINGERPRINT}`;

/**
 * 평평한 1시간 TTL. 미국 캐시와 같은 근거다 — `computeBarsEffectiveTtl`은 "다음 개장까지"로
 * 상한을 잡는데, 그러면 금요일 마감 뒤 하루 종일 같은 값이 고정된다. 이 지수가 먹는
 * EOD 종가는 **마감 직후에** 들어오므로, 마감 시각에 캐시된 항목이야말로 살아남으면
 * 안 되는 항목이다.
 */
const TTL_SECONDS = SECONDS_PER_HOUR;

/**
 * 여섯 시리즈를 모아 페이지가 그리는 형태로 줄인다.
 *
 * `vix`만 다르다: 티커가 없어 코스피 지수 종가에서 20일 실현변동성을 산출한다
 * (근거는 `realizedVolatility.ts`). 나머지 다섯은 ETF 종가를 그대로 쓴다.
 *
 * 여섯 번의 yahoo 호출은 1시간 Redis 캐시 뒤에 있어 시간당 6회다. 라이브러리 큐가
 * `concurrency: 4`라 실질 2배치로 끝난다 — 청크 분할 이득이 없다.
 */
async function buildView(now: Date): Promise<MarketFearGreedView> {
    const from = krLookbackStartDate(now);
    // 상한을 "이미 마감·게시된 세션"으로 끊는다. 그러지 않으면 장중 시세가 종가로
    // 섞여 들어와 하루 종일 값이 흔들리면서 화면에는 "종가 기준"이라고 적힌다.
    // KRX 공휴일·주말 되감기는 `lastClosedSessionDate`가 처리한다.
    //
    // `T15:00:00Z` = 그 KST 달력일의 끝(24:00 KST). `lastClosedSessionDate`가 주는
    // 날짜는 **KST 달력일**이라, `T23:59:59Z`로 끊으면 상한이 다음 KST 날 09:00까지
    // 넘어간다. 지금은 yahoo가 KRX 일봉을 09:00 KST 개장 인스턴트로 찍어서
    // **1초 차이로** 다음 날 봉이 안 들어오고 있을 뿐이다 — 개장 시각이 바뀌거나
    // yahoo가 찍는 시각이 종가 쪽으로 옮겨가면 장중 값이 "종가 기준" 시리즈로
    // 들어온다. 그 여유를 9시간으로 되돌린다.
    const to = new Date(
        `${lastClosedSessionDate(KR_EQUITY_SESSION, now)}T15:00:00Z`
    );

    const [tickerSeries, kospiCloses] = await Promise.all([
        Promise.all(
            MARKET_FEAR_GREED_KR_SERIES.map(async ({ key, symbol }) => ({
                key,
                closes: await fetchKrDailyCloses(symbol, from, to),
            }))
        ),
        fetchKrDailyCloses(KOSPI_INDEX_SYMBOL, from, to),
    ]);

    // safe: `tickerSeries`는 core의 `MARKET_FEAR_GREED_SERIES_KEYS`에서 파생된
    // `MARKET_FEAR_GREED_KR_SERIES`를 map한 것이고 `vix`를 여기서 채우므로, Record의
    // 모든 키가 정확히 한 번씩 들어간다. `Object.fromEntries`가 그 사실을 잃을 뿐이다.
    const input = {
        ...Object.fromEntries(tickerSeries.map(s => [s.key, s.closes])),
        vix: toRealizedVolatilitySeries(kospiCloses),
    } as MarketFearGreedInput;

    return {
        snapshot: computeMarketFearGreedIndex(input),
        comparisons: buildMarketFearGreedComparisons(
            computeMarketFearGreedHistory(input)
        ),
    };
}

/** snapshot이 없는 뷰 = 표본 부족. 그 상태를 캐시에 굳히지 않는다. */
function hasSnapshot(view: MarketFearGreedView): boolean {
    return view.snapshot !== null;
}

/**
 * 한국 시장 공포·탐욕 판독값 — `React.cache` → Redis → yahoo.
 *
 * yahoo 호출이 하나라도 실패하면 `Promise.all`에서 그대로 던진다(빈 시리즈로
 * degrade하지 않는다). 바스켓이 일부만 채워지면 점수의 **의미가 조용히 바뀌고**,
 * `getOrSetCache`는 fetcher가 던졌을 때 아무것도 쓰지 않으므로 그게 옳은 동작이다.
 */
export const getCachedMarketFearGreedKr = cache(
    (): Promise<MarketFearGreedView> =>
        getOrSetCache(
            CACHE_KEY,
            TTL_SECONDS,
            () => buildView(new Date()),
            hasSnapshot
        )
);
