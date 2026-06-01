import { unstable_cache } from 'next/cache';
import type { BarsData, Timeframe } from '@y0ngha/siglens-core';
import { getBarsAction } from '@/entities/bars/actions';

/**
 * ISR static-safe bars fetch. `getBarsAction`(redis getOrSetCache + FMP)을 Next data
 * cache로 감싸 static generate가 no-store fetch에 막히지 않게 한다. 종목당 캐시이며
 * revalidate=1h로 주기 갱신한다. 호출부는 본 함수만 쓴다.
 *
 * 전제: 이 정적화는 root layout cookies() 제거(축 0)가 선결돼야 효과가 있다 — PoC에서
 * layout이 전 라우트를 dynamic으로 강제하면 unstable_cache 래핑도 무력했다(PoC 1 vs 7).
 */
export function getBarsStatic(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    return unstable_cache(
        () => getBarsAction(symbol, timeframe, fmpSymbol),
        ['bars-static', symbol, timeframe, fmpSymbol ?? ''],
        { revalidate: 3600, tags: [`symbol:${symbol}`] }
    )();
}
