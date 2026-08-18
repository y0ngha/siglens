import type { MarketNewsRow } from '../model';

/**
 * Market-news display card — `NewsDisplayItem` plus `tickers` for display chips.
 * Intentionally narrow: only what the client needs for rendering; DB-internal
 * fields (bodyEn, symbol, analyzedAt) are excluded.
 *
 * 이 타입은 서버 행과 RSC 페이로드 사이의 allowlist 계약이다. 투영 자체는 더 이상
 * JS 매퍼가 아니라 **읽기(`listCardsByCategory`)의 SELECT**가 수행한다 — 받은 뒤
 * 거르면 Neon 전송과 S3 ISR 블롭에는 그대로 남기 때문이다(감사: 비용 라운드 15).
 * 그래서 짝이던 `toMarketNewsCardItem` 함수는 삭제됐고, 계약인 이 타입만 남는다
 * (종목 뉴스 슬라이스의 `toNewsDisplayItem`도 같은 이유로 사라졌다).
 */
export type MarketNewsCardItem = Omit<
    MarketNewsRow,
    'bodyEn' | 'symbol' | 'analyzedAt'
>;
