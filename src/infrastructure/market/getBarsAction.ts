'use server';

import {
    type BarsData,
    type Timeframe,
    fetchBarsWithIndicators,
} from '@y0ngha/siglens-core';

// cacheComponents 비활성 기간 동안 'use cache' / cacheLife / cacheTag 제거.
// bars API 호출은 매 요청마다 fresh — 캐싱 손실은 일시적이며 향후 PPR 재활성화
// 또는 unstable_cache 도입 시 복원할 것 (이슈 #439 참조).
export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    return fetchBarsWithIndicators(symbol, timeframe, fmpSymbol);
}
