import 'server-only';
import {
    type Bar,
    type GetBarsOptions,
    type MarketDataProvider,
    type MarketQuote,
    type Timeframe,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';

/** quote TTL은 bars 일봉 개장-경계 정책을 재사용 — timeframe과 무관한 placeholder. */
const QUOTE_TTL_TIMEFRAME = '1Day' as const satisfies Timeframe;

/**
 * FmpMarketProvider는 limit을 URL에 쓰지 않고(date-window 기반) symbol/timeframe/
 * from/before로만 결과가 결정되므로 키에서 limit을 제외한다.
 */
function buildBarsRawKey(o: GetBarsOptions): string {
    return `bars:raw:${o.symbol.toUpperCase()}:${o.timeframe}:${o.from ?? ''}:${o.before ?? ''}`;
}

/**
 * `MarketDataProvider`를 감싸 getBars/getQuote에 provider 레벨 Redis 캐싱을 주입하는
 * 데코레이터. 분석/차트 경로가 동일 provider를 거치므로(차트 getBarsAction, 분석
 * submitAnalysis/submitOverallAnalysis), 여기서 캐싱하면 차트·분석·today-quote·
 * fear&greed 1Day가 같은 캐시를 공유한다 — 분석 결과 cache-miss 시 차트가 워밍한
 * bars를 재사용해 FMP 직격을 막는다. `CachedFundamentalProvider` 패턴과 동형이다.
 *
 * inner.getBars가 FMP 장애로 throw하면 getOrSetCache의 set 전에 전파되어 장애가
 * 캐싱되지 않는다(poison 방지). 빈 봉/ null quote는 shouldCache 가드로 미캐싱해
 * transient 결과를 TTL 동안 굳히지 않는다. Redis 미설정/장애 시 getOrSetCache가
 * graceful fallback(inner 직접 호출)한다.
 *
 * market summary/sector signals 경로는 이 데코레이터를 쓰지 않는다(getMarketDataProvider
 * raw 사용 — market-isr 전담). 적용은 getCachedMarketDataProvider 팩토리가 담당.
 */
export class CachedMarketDataProvider implements MarketDataProvider {
    constructor(private readonly inner: MarketDataProvider) {}

    getBars = (options: GetBarsOptions): Promise<Bar[]> =>
        getOrSetCache(
            buildBarsRawKey(options),
            computeBarsEffectiveTtl(options.timeframe, new Date()),
            () => this.inner.getBars(options),
            bars => bars.length > 0
        );

    getQuote = (symbol: string): Promise<MarketQuote | null> =>
        getOrSetCache(
            `quote:${symbol.toUpperCase()}`,
            computeBarsEffectiveTtl(QUOTE_TTL_TIMEFRAME, new Date()),
            () => this.inner.getQuote(symbol),
            quote => quote !== null
        );
}
