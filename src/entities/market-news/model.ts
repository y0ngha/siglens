import type { NewsDisplayItem } from '@/shared/lib/types';

// 피드 카테고리 식별자는 core union을 siglens 쪽에서 넓힌 것이다(한국 증시 추가).
// 근거는 `lib/categoryConfig.ts`의 `NewsFeedCategoryId` 주석 참조.
export type { NewsFeedCategoryId } from './lib/categoryConfig';

/**
 * Row from the `market_news` table — display projection + persistence fields + tickers.
 * Extends `NewsDisplayItem` with fields that are present in the DB row but
 * not surfaced as display-only metadata.
 */
export interface MarketNewsRow extends NewsDisplayItem {
    /**
     * 항상 `null`이다. 읽기 경로가 `body_en`을 SELECT하지 않는다 — 이 값을 읽는
     * 유일한 소비자(core `newsCardPrompt`)는 DB 행이 아니라 FMP 응답 객체를 받는다.
     * core의 `EnrichedNewsItem` 형상을 맞추려고 필드만 남겨 둔다.
     */
    bodyEn: string | null;
    /** Sentinel bucket symbol (e.g. `__NEWS_CRYPTO__`). Never shown in a URL. */
    symbol: string;
    /** Article's own ticker symbols for display chips; `[]` for general/articles. */
    tickers: string[];
    /** Timestamp the LLM analysis was attached; null before analysis. */
    analyzedAt: Date | null;
}
