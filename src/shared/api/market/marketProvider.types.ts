import type { Bar, MarketDataProvider } from '@y0ngha/siglens-core';

/**
 * siglens 확장 market provider — core `MarketDataProvider` 포트에 오늘 봉(quote 기반)
 * 조회를 더한다. EOD 일봉 캐시가 과거(EOD)와 오늘(quote)을 분리 조달하는 데 쓴다.
 */
export interface SiglensMarketProvider extends MarketDataProvider {
    getTodayBar(symbol: string): Promise<Bar | null>;
}
