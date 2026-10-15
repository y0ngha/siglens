import type {
    Bar,
    GetBarsOptions,
    MarketDataProvider,
    MarketQuote,
} from '@y0ngha/siglens-core';

/**
 * 업스트림 quote 호출 한 번에서 나오는 두 가지 모양.
 * - `quote`: 현재가·등락률(`getQuote`의 소비자)
 * - `todayBar`: 같은 행으로 만든 오늘(최근 거래일) OHLCV 봉(EOD 일봉 캐시의 live tail)
 *
 * 둘 다 같은 원본 행에서 나오므로 어느 한쪽이 `null`이면 보통 다른 쪽도 `null`이다
 * (조회 실패·빈 응답·종목 없음). 매핑 단계의 예외만 한쪽만 `null`로 만들 수 있다.
 * `data` 키를 두지 않는다 — `getOrSetCache`의 envelope 판별(`'data' in value`)과 겹치지 않게.
 */
export interface QuoteSnapshot {
    quote: MarketQuote | null;
    todayBar: Bar | null;
}

/**
 * FMP `aftermarket-trade`의 마지막 체결 한 건 — 프리·애프터마켓 **표시 전용** 가격.
 *
 * 봉·`todayBar`·지표·분석 입력에는 절대 섞지 않는다(정규장 시세 스냅샷과 별개 계통).
 * `timestampMs`는 FMP 원본 그대로 epoch 밀리초다(`quote`의 `timestamp`는 초라 단위가 다르다).
 */
export interface ExtendedHoursTrade {
    price: number;
    tradeSize: number;
    timestampMs: number;
}

/**
 * siglens 확장 market provider — core `MarketDataProvider` 포트에 오늘 봉(quote 기반)
 * 조회를 더한다. EOD 일봉 캐시가 과거(EOD)와 오늘(quote)을 분리 조달하는 데 쓴다.
 *
 * `getQuoteSnapshot`은 시세와 오늘 봉을 **업스트림 호출 한 번**으로 돌려준다. 예전에는
 * `getQuote`와 `getTodayBar`가 같은 FMP `quote` 엔드포인트를 따로 불러, 캐시 계층이 같은
 * 데이터를 두 키로 두 번 받았다. 캐시 데코레이터는 이 메서드 하나만 부른다.
 * 실패는 던지지 않고 `{ quote: null, todayBar: null }`로 degrade한다(기존 getQuote 의미).
 *
 * `getTodayBar`는 캐시 계층이 더는 부르지 않지만 포트에 남긴다 — FMP 어댑터의 캐시 없는
 * 일봉 경로(`getDailyBars`)가 오늘 봉을 붙일 때 쓰고, 캐시를 거치지 않는 raw provider
 * 소비자가 "오늘 봉만" 필요할 때 스냅샷의 시세 매핑까지 요구하지 않게 하려는 것이다.
 */
export interface SiglensMarketProvider extends MarketDataProvider {
    getTodayBar(symbol: string): Promise<Bar | null>;
    getQuoteSnapshot(symbol: string): Promise<QuoteSnapshot>;
}

/**
 * 프리·애프터마켓을 포함한 인트라데이 봉 조회 — **표시 전용** 계통.
 *
 * `MarketDataProvider.getBars`(정규장 봉: 지표·분석·섹터 스캔·SEO의 입력)와 분리된 메서드다.
 * 이 결과를 지표·분석 입력에 섞지 않는다(`src/__tests__/guards/extendedBarsDisplayOnly.test.ts`).
 * 구현은 FMP 어댑터와 그것을 감싸는 `CachedMarketDataProvider`뿐이다(Yahoo·Fake는 없음).
 */
export interface ExtendedBarsProvider {
    getExtendedBars(options: GetBarsOptions): Promise<Bar[]>;
}
