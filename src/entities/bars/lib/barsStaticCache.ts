import { unstable_cache } from 'next/cache';
import type { BarsData, Timeframe } from '@y0ngha/siglens-core';
import { getBarsAction } from '../actions';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

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
        { revalidate: SECONDS_PER_HOUR * 6, tags: [`symbol:${ticker}`] }
    )();
}
