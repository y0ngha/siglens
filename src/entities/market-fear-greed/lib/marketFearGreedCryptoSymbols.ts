/**
 * 암호화폐 시장 공포·탐욕 지수의 FMP 티커 표.
 *
 * core(`CryptoFearGreedInput`)는 티커를 모르고 경제적 역할만 안다 — 벤치마크(BTC),
 * 안전자산(금), 나머지 대형 코인 유니버스. 여기가 그 역할을 FMP 심볼로 잇는 유일한
 * 곳이다(미국판 `marketFearGreedSymbols.ts`와 같은 층의 결정).
 *
 * 유니버스는 2026-09-25 기준 대형 코인 중 FMP에서 3년 이상의 일봉과 0이 아닌 거래량이
 * 확인된 19개다. 스테이블코인은 넣지 않는다 — 가격이 1달러에 묶여 있어 추세·폭 요인에
 * 잡음만 더한다. **오늘의** 대형 코인 목록이라 과거 구간에는 생존 편향이 있다(FAQ 고지).
 */
export const MARKET_FEAR_GREED_CRYPTO_BENCHMARK = 'BTCUSD';

/** 금 현물. 주 5일 거래라 주말은 core가 금요일 종가로 채운다. */
export const MARKET_FEAR_GREED_CRYPTO_SAFE_HAVEN = 'GCUSD';

export const MARKET_FEAR_GREED_CRYPTO_UNIVERSE = [
    'ETHUSD',
    'XRPUSD',
    'SOLUSD',
    'BNBUSD',
    'DOGEUSD',
    'ADAUSD',
    'TRXUSD',
    'LINKUSD',
    'LTCUSD',
    'AVAXUSD',
    'DOTUSD',
    'BCHUSD',
    'XLMUSD',
    'SHIBUSD',
    'HBARUSD',
    'SUIUSD',
    'TONUSD',
    'UNIUSD',
    'NEARUSD',
] as const;

/** 조회 창(달력일). 미국·한국판과 같은 3년 — 워밍업 124세션과 "1년 전" 비교를 덮는다. */
export const MARKET_FEAR_GREED_CRYPTO_LOOKBACK_DAYS = 1095;
