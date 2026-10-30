import type { MarketNewsRow } from '../model';

/**
 * 시장 뉴스 표시 카드 — `NewsDisplayItem`에 표시 칩용 `tickers`를 더한 것. 클라이언트
 * 렌더링에 필요한 것만 남기고 DB 내부 필드(bodyEn, symbol, analyzedAt)는 뺀다.
 *
 * 서버 행과 RSC 페이로드 사이의 allowlist 계약이다. 투영 자체는 JS 매퍼가 아니라
 * **읽기(`listCardsByCategory`)의 SELECT**가 수행한다 — 받은 뒤 거르면 Neon 전송과
 * S3 ISR 블롭에는 그대로 남기 때문이다. 그래서 이 파일에는 계약인 타입만 있다.
 */
export type MarketNewsCardItem = Omit<
    MarketNewsRow,
    'bodyEn' | 'symbol' | 'analyzedAt'
>;
