import {
    MARKET_FEAR_GREED_SERIES_KEYS,
    type MarketFearGreedSeriesKey,
} from '@y0ngha/siglens-core';

/**
 * 코스피 지수 티커. `vix` 슬롯에 넣을 실현변동성의 원천이다.
 *
 * KODEX 200(`069500.KS`)이 아니라 지수를 쓰는 이유: ETF 가격은 분배금 락과 괴리율이
 * 섞여 있어 변동성이 소폭 부풀고, 변동성 산출에는 지수 레벨이 더 정확하다.
 * (`sp500`/`equalWeight` 같은 수익률 비교 항목은 반대로 ETF끼리 맞춰야 한다 —
 * 미국 쪽이 `^GSPC` 대신 SPY를 고른 것과 같은 이유.)
 */
export const KOSPI_INDEX_SYMBOL = '^KS11';

/**
 * 의미(semantic) 키 → yahoo 티커. `vix`만 티커가 없고 파생값이라 여기 없다.
 *
 * core는 티커를 모르고 경제적 역할만 안다 — "a consumer backed by another provider
 * is free to map differently as long as the economic meaning holds"
 * (core `MarketFearGreedSeriesKey` JSDoc). 아래는 그 매핑의 한국판이다.
 *
 * 2026-08-18 전부 실호출 확인(3년 창에서 720~722 거래일).
 *
 * | 키 | 티커 | 확인된 이름 | 고른 이유 |
 * |---|---|---|---|
 * | `sp500` | `069500.KS` | KODEX 200 | 시총가중 대형주 벤치마크 ETF = SPY 자리 |
 * | `longTreasury` | `439870.KS` | KODEX 국고채30년 액티브 | 장기물 안전자산 = TLT 자리(20년+) |
 * | `highYield` | `136340.KS` | KStar 회사채 | 신용위험을 지는 쪽. 국내엔 유동성 있는 하이일드 ETF가 없어 회사채가 최선 |
 * | `investmentGrade` | `114260.KS` | Samsung Kodex Treasury Bond Securities ETF(KODEX 국고채3년) | 무위험 쪽. `highYield`(KStar 회사채, 1~3년물, 듀레이션 ≈2년)와 만기를 맞추려 3년물 |
 * | `equalWeight` | `252650.KS` | KODEX 200 동일가중 | 코스피200 동일가중 = RSP의 정확한 대응 |
 *
 * `investmentGrade`는 `highYield`와 듀레이션을 맞춰야 한다 — 회사채(1~3년물)보다
 * 훨씬 긴 무위험 채권(예: 10년물)을 짝지으면 `junk_bond` 스프레드가 신용 선호가 아니라
 * 순수 금리 변화를 재는 지표로 오염된다. 금리 인하 랠리마다 장기 국채가 회사채보다
 * 더 크게 오르며 스프레드가 벌어져, 신용 시장은 멀쩡한데 매번 거짓 "공포" 신호를 낸다.
 * `longTreasury`(30년)와는 여전히 만기가 달라 `safe_haven`과 `junk_bond`의 독립성은
 * 유지된다.
 */
export const MARKET_FEAR_GREED_KR_SYMBOLS = {
    sp500: '069500.KS',
    longTreasury: '439870.KS',
    highYield: '136340.KS',
    investmentGrade: '114260.KS',
    equalWeight: '252650.KS',
} as const satisfies Record<Exclude<MarketFearGreedSeriesKey, 'vix'>, string>;

/**
 * Calendar-day lookback requested from yahoo. 미국판과 같은 3년 —
 * 모멘텀 창 125세션 + `confidence: 'normal'`에 필요한 60세션을 채우고,
 * 페이지가 그리는 "1년 전" 비교까지 덮는다.
 */
export const MARKET_FEAR_GREED_KR_LOOKBACK_DAYS = 1095;

/** 티커가 있는 시리즈들, 안정된 순서로. `vix`는 파생이라 제외된다. */
export const MARKET_FEAR_GREED_KR_SERIES =
    MARKET_FEAR_GREED_SERIES_KEYS.flatMap(key =>
        key === 'vix'
            ? []
            : [{ key, symbol: MARKET_FEAR_GREED_KR_SYMBOLS[key] }]
    );
