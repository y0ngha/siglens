/**
 * 신호 스캔 대상 목록의 크기 기준. 생성 스크립트와 가드 테스트가 같은 값을 읽는다 —
 * 지수 크기가 바뀌면(S&P 500 종목 수 변동, KRX 정기변경) 한 곳만 고친다.
 */

/** S&P 500 목록(Wikipedia 표)의 허용 개수. `indexConstituents.ts`의 `sp500` 범위와 같은 값이다. */
export const US_SP500_COUNT_RANGE = { min: 495, max: 510 } as const;

/** 코스피 200·코스닥 150 지수의 공식 종목 수. */
export const KR_INDEX_SIZE = { kospi200: 200, kosdaq150: 150 } as const;

/**
 * 지수 종목 수와 스냅샷 종목 수가 벌어져도 받아들이는 폭. ETF 보유 종목(프록시)은 정기변경 직전·직후에
 * 지수와 한두 종목 어긋나기 때문이다. 이보다 벌어지면 가드 테스트와 생성 스크립트가 실패한다.
 */
export const KR_INDEX_COUNT_TOLERANCE = 5;
