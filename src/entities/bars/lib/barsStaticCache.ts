import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import type { MarketProfileId } from '@/shared/config/marketProfile';
import { quantizeBarsDataToLastClosed } from './quantizeBars';
import {
    EMPTY_INDICATOR_RESULT,
    type BarsData,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { getBarsAction } from '../actions';
import { SECONDS_PER_QUARTER_DAY } from '@/shared/config/time';

/**
 * ISR static-safe bars fetch. `getBarsAction`(redis getOrSetCache + FMP)을 Next data
 * cache로 감싸 static generate가 no-store fetch에 막히지 않게 한다. 종목당 캐시이며
 * revalidate=6h 상한으로 주기 갱신한다. 호출부는 본 함수만 쓴다.
 *
 * revalidate=6h 이유: 사용자 신선도는 클라이언트 `useBars` 30초 refetch가 담당한다.
 * 이 shared layout cache가 1h였을 때, Next 16의 route effective s-maxage를 "렌더 중
 * 읽힌 unstable_cache revalidate 최솟값"으로 clamp하는 규칙에 의해 `/[symbol]/*` 전
 * 서브페이지(6h·12h·24h 선언)가 1h로 의도치 않게 clamp되는 부작용이 있었다.
 * 6h로 맞춤으로써 `[symbol]`(6h) 페이지와 정렬하고 12h·24h 서브페이지의 clamp를 해소.
 * on-demand 무효화는 `revalidateTag('symbol:AAPL')`로 여전히 가능.
 *
 * 전제: 이 정적화는 root layout cookies() 제거(축 0)가 선결돼야 효과가 있다 — PoC에서
 * layout이 전 라우트를 dynamic으로 강제하면 unstable_cache 래핑도 무력하다.
 *
 * symbol은 대문자로 정규화한다 — 호출부가 라우트 param(소문자 'aapl')과 ticker(대문자
 * 'AAPL') 양쪽으로 호출하므로, 정규화하지 않으면 같은 종목이 'AAPL'/'aapl' 두 unstable_cache
 * 엔트리·태그로 분기돼 캐시 중복 + revalidateTag('symbol:AAPL') 무효화 누락이 생긴다.
 * fmpSymbol은 FMP 고유 심볼이라 대소문자를 보존한다.
 */
export function getBarsStatic(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    const ticker = symbol.toUpperCase();
    return unstable_cache(
        () => getBarsAction(ticker, timeframe, fmpSymbol),
        ['bars-static', ticker, timeframe, fmpSymbol ?? ''],
        { revalidate: SECONDS_PER_QUARTER_DAY, tags: [`symbol:${ticker}`] }
    )();
}

/**
 * `getBarsStatic` + `quantizeBarsDataToLastClosed`를 요청 단위로 **한 번만** 수행한다.
 * `/[symbol]` 트리에서 bars를 seed하는 호출부는 모두 이 함수를 써야 한다.
 *
 * ## 왜 필요한가 — RSC 페이로드에 지표가 두 벌 실리는 문제
 *
 * layout(`SymbolLayoutChrome`)과 page가 각각 같은 쿼리 키로 `setQueryData` → `dehydrate`
 * 한다. Flight 직렬화기는 **동일 객체 참조**일 때만 두 번째 등장을
 * `"$2d:props:state:queries:1:state:data:bars"` 같은 참조로 접는다. 접히지 않으면
 * 지표 한 벌(약 507KB)이 통째로 더 실린다.
 *
 * 참조가 갈리는 지점이 둘이었다:
 * 1. `getBarsAction`이 `roundIndicators`로 매 호출 새 `indicators`를 만든다(v0.53.3).
 * 2. `quantizeBarsDataToLastClosed`가 **정규장 중일 때** 새 객체를 할당한다
 *    (`quantizeBars.ts` — 장 마감엔 입력을 그대로 통과시킨다). 크립토는 24/7이라 상시 해당.
 *
 * 그래서 v0.53.3 이전에도 **장중·크립토에서는 이미 두 벌**이었고, 장 마감에만 한 벌이었다.
 * 이 함수가 두 단계를 함께 감싸 요청 스코프에서 접으므로, 세션 상태·자산군과 무관하게
 * 항상 한 벌이 된다.
 *
 * ⚠️ 인자는 전부 원시값이어야 하고(`React.cache`는 인자를 `Object.is`로 키잉한다),
 * 호출부는 **대문자 ticker**로 통일해 넘긴다 — `'aapl'`과 `'AAPL'`이 갈리면 접기가 깨진다.
 * `now`를 인자로 받지 않는 것도 같은 이유다(매 호출 다른 `Date`는 키를 무조건 깨뜨린다).
 */
export const getQuantizedBarsStatic = cache(
    async (
        ticker: string,
        timeframe: Timeframe,
        marketProfile: MarketProfileId,
        fmpSymbol?: string
    ): Promise<BarsData> => {
        const data = await getBarsStatic(ticker, timeframe, fmpSymbol);
        return quantizeBarsDataToLastClosed(
            data,
            new Date(),
            sessionSpecFor(marketProfile)
        );
    }
);

/**
 * `getQuantizedBarsStatic`의 **RSC seed 전용** 축소판. 첫 페인트가 실제로 읽는 지표만
 * 남기고 나머지를 `EMPTY_INDICATOR_RESULT`의 빈 값으로 대체한다.
 *
 * ## 왜 — 직렬화되는 지표의 대부분을 아무도 읽지 않는다
 *
 * `/[symbol]` RSC 페이로드 651KB 중 약 507KB가 `IndicatorResult`다(501봉 × 지표 30여 종).
 * 그런데 차트 오버레이/보조지표 창은 **전부 기본 OFF**이고(`useIndicatorVisibility`의
 * 초기값이 34개 키 모두 false, MA/EMA 기본 period는 빈 배열), 각 훅은 `isVisible`이
 * false면 데이터를 건드리기 전에 빠져나간다. 즉 콜드 방문자에게 직렬화된 지표의
 * 대부분은 어떤 코드 경로도 읽지 않는다.
 *
 * 첫 페인트에 실제로 필요한 것은 셋뿐이다:
 * - `rsi`·`macd` — `buildTechnicalFacts`가 **스칼라 한 개씩**으로 접는다(FactLayer).
 * - `buySellVolume` — 거래량 차트와 공포·탐욕 지수가 전 구간을 쓴다.
 *
 * ## 왜 안전한가
 *
 * 1. `EMPTY_INDICATOR_RESULT`는 모든 키가 올바른 타입의 빈 값으로 채워진 완전한
 *    `IndicatorResult`다. 빠진 키를 읽어 터지는 소비자가 없다.
 * 2. 클라이언트는 **마운트 직후 전체를 다시 받는다**. seed의 `dataUpdatedAt`은 마지막
 *    봉 시각(수 시간~수 일 전)으로 고정되는데 `BARS_STALE_TIME_MS`는 30초라, 이 축소된
 *    지표는 항상 stale로 판정돼 곧바로 원본으로 교체된다. 사용자가 그 사이에 오버레이를
 *    켜면 한 프레임 빈 시리즈를 볼 수 있으나, 오버레이는 기본 OFF라 켜는 행위 자체가
 *    재요청 이후다.
 * 3. `buildTechnicalFacts` 입력(rsi·macd)이 그대로라 SSR HTML 텍스트는 **바이트 동일**이다
 *    — SEO·hydration mismatch 영향 없음.
 *
 * ⚠️ 이 축소는 **seed(=`setQueryData`) 경로에만** 적용한다. 서버에서 지표를 직접 읽는
 * 소비자(`buildTechnicalFacts` 등)는 `getQuantizedBarsStatic` 원본을 계속 써야 한다.
 * ⚠️ `getBarsAction`(클라이언트 재요청 경로)은 **절대 축소하지 않는다**. 축소한 seed의
 * 정확성을 그 재요청이 떠받치고 있다.
 * ⚠️ `React.cache`로 감싸는 이유는 `getQuantizedBarsStatic`과 동일하다 — layout과 page가
 * 각각 호출해도 **같은 객체 참조**를 받아야 Flight 직렬화기가 두 번째 등장을 접는다.
 * 호출부에서 매번 새로 객체를 만들면 접기가 깨져 축소분이 두 벌 실린다.
 * ⚠️ MA/EMA는 `indicators.ma[period]`처럼 **동적 키 접근**이다. 지금은 기본 period가
 * 빈 배열이라 안전하지만, 누군가 `defaultPeriods`에 값을 주면 first-paint 소비자가 되므로
 * 이 화이트리스트도 함께 넓혀야 한다.
 */
export const getSeedBarsStatic = cache(
    async (
        ticker: string,
        timeframe: Timeframe,
        marketProfile: MarketProfileId,
        fmpSymbol?: string
    ): Promise<BarsData> => {
        const data = await getQuantizedBarsStatic(
            ticker,
            timeframe,
            marketProfile,
            fmpSymbol
        );
        return {
            bars: data.bars,
            indicators: {
                ...EMPTY_INDICATOR_RESULT,
                rsi: data.indicators.rsi,
                macd: data.indicators.macd,
                buySellVolume: data.indicators.buySellVolume,
            },
        };
    }
);
