'use server';

import {
    type BarsData,
    type Timeframe,
    fetchBarsWithIndicators,
} from '@y0ngha/siglens-core';
import { withRetry } from '@/shared/lib/withRetry';
import {
    getFmpUserFacingMessage,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';
import { BARS_FMP_RETRY } from '../lib/barsRetry';

// cacheComponents 비활성 기간 동안 'use cache' / cacheLife / cacheTag 제거.
// bars API 호출은 매 요청마다 fresh — 캐싱 손실은 일시적이며 향후 PPR 재활성화
// 또는 unstable_cache 도입 시 복원할 것 (이슈 #439 참조).
//
// fundamentalData/newsData와 달리 React.cache로 감싸지 않는 이유:
// `'use server'` Server Action은 클라이언트에서 호출될 때 별도 RPC 경로로 실행되어
// RSC render 컨텍스트의 per-request memoization을 공유하지 못한다. RSC에서
// `prefetchQuery`로 호출되는 경로(layout.tsx)도 단일 호출이라 dedup 이득이 없다.
export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    try {
        return await withRetry(
            () => fetchBarsWithIndicators(symbol, timeframe, fmpSymbol),
            BARS_FMP_RETRY
        );
    } catch (error) {
        logFmpPaymentRequiredError(error);
        const message = getFmpUserFacingMessage(error);
        if (message !== null) {
            throw new Error(message, { cause: error });
        }
        throw error;
    }
}
