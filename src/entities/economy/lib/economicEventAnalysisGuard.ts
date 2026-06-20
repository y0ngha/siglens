import type { NewsSentiment } from '@y0ngha/siglens-core';

/**
 * `economic_calendar.sentiment`(raw text, CHECK 없음)를 읽기 경계에서 검증한다.
 * 유효하지 않은 값(스키마 드리프트·수동 SQL·구버전 데이터)은 null로 강등해 표시
 * 계층이 배지 없이 graceful 폴백한다(`market_news`의 NEWS_SENTIMENT_RECORD 미러).
 *
 * `EconomicEventAnalysis.sentiment`는 core의 `NewsSentiment`와 동일한
 * 'bullish'|'neutral'|'bearish' tri-state라 같은 DESIGN 토큰을 재사용한다.
 */
const EVENT_SENTIMENT_RECORD: Record<NewsSentiment, true> = {
    bullish: true,
    neutral: true,
    bearish: true,
};

export function toEventSentiment(value: unknown): NewsSentiment | null {
    return typeof value === 'string' && value in EVENT_SENTIMENT_RECORD
        ? (value as NewsSentiment)
        : null;
}
