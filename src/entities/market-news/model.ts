import type { NewsDisplayItem } from '@/shared/lib/types';

/**
 * `market_news` 행 — 표시 투영 + 저장 필드 + 티커. 표시 전용 메타데이터로는 내보내지
 * 않는 DB 행 필드로 `NewsDisplayItem`을 확장한다.
 */
export interface MarketNewsRow extends NewsDisplayItem {
    /**
     * 항상 `null`이다. 읽기 경로가 `body_en`을 SELECT하지 않는다 — 이 값을 읽는
     * 유일한 소비자(core `newsCardPrompt`)는 DB 행이 아니라 FMP 응답 객체를 받는다.
     * core의 `EnrichedNewsItem` 형상을 맞추려고 필드만 남겨 둔다.
     */
    bodyEn: string | null;
    /** 센티널 버킷 심볼(예: `__NEWS_CRYPTO__`). URL에는 노출되지 않는다. */
    symbol: string;
    /** 표시 칩용 기사 자체 티커 심볼. general/articles는 `[]`. */
    tickers: string[];
    /** LLM 분석이 붙은 시각. 분석 전에는 `null`. */
    analyzedAt: Date | null;
}
