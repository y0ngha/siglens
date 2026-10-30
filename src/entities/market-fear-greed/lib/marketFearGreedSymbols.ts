import {
    MARKET_FEAR_GREED_SERIES_KEYS,
    type MarketFearGreedSeriesKey,
    FEAR_GREED_LOOKBACK_DAYS,
} from '@y0ngha/siglens-core';

/**
 * 의미(semantic) 키 → FMP 티커. `siglens-core`는 일부러 티커가 아니라 경제적 역할로
 * 말하므로, 이 지수가 FMP를 소스로 쓴다는 것을 아는 곳은 이 표뿐이다(데이터 소스 지식은
 * 소비자 몫이다).
 *
 * `sp500`이 `^GSPC` 지수가 아니라 SPY인 이유: 다섯 요인 중 셋이 ETF(TLT / HYG / LQD /
 * RSP)와의 수익률 *차이*다. 지수 레벨과 ETF 가격을 섞으면 서로 다른 기준의 시리즈를
 * 비교하게 되므로, SPY를 써서 모든 다리를 같은 기준에 둔다.
 */
export const MARKET_FEAR_GREED_SYMBOLS = {
    sp500: 'SPY',
    vix: '^VIX',
    longTreasury: 'TLT',
    highYield: 'HYG',
    investmentGrade: 'LQD',
    equalWeight: 'RSP',
} as const satisfies Record<MarketFearGreedSeriesKey, string>;

/**
 * FMP에 요청하는 달력일 조회 창. 지수는 모멘텀 창을 데우는 125세션에 더해
 * `confidence: 'normal'`용 60세션이 필요하고, 페이지가 "1년 전" 비교를 그린다.
 *
 * core 2.10.0부터 5년(`FEAR_GREED_LOOKBACK_DAYS`): 모든 판독이 이 이력 대비 백분위라
 * 종목별 지수와 시장 지수가 한 창을 공유한다 — 2년은 극단 구간 사례가 너무 적어 의미가
 * 없었고, 과거가 길수록 기준선이 안정된다. 이 값을 바꾸면 모든 점수가 바뀌므로 로컬
 * 숫자가 아니라 core 상수를 따른다.
 */
export const MARKET_FEAR_GREED_LOOKBACK_DAYS = FEAR_GREED_LOOKBACK_DAYS;

/** 모든 시리즈 키와 FMP 티커의 쌍, 안정된 순서. 캐시 계층이 이 순서로 fan-out한다. */
export const MARKET_FEAR_GREED_SERIES = MARKET_FEAR_GREED_SERIES_KEYS.map(
    key => ({ key, symbol: MARKET_FEAR_GREED_SYMBOLS[key] })
);
