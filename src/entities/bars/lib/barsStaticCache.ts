import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import type { MarketProfileId } from '@/shared/config/marketProfile';
import { quantizeBarsDataToLastClosed } from './quantizeBars';
import type { BarsData, Timeframe } from '@y0ngha/siglens-core';
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
