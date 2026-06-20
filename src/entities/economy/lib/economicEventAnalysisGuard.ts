import type { NewsSentiment } from '@y0ngha/siglens-core';
import { isNewsSentiment } from '@/shared/lib/sentimentDisplay';

/**
 * `economic_calendar.sentiment`(raw text, CHECK 없음)를 읽기 경계에서 검증한다.
 * 유효하지 않은 값(스키마 드리프트·수동 SQL·구버전 데이터)은 null로 강등해 표시
 * 계층이 배지 없이 graceful 폴백한다.
 *
 * `EconomicEventAnalysis.sentiment`는 core의 `NewsSentiment`와 동일한
 * 'bullish'|'neutral'|'bearish' tri-state라 `isNewsSentiment`(shared/lib/sentimentDisplay)를
 * 그대로 재사용한다. `isNewsSentiment`가 type guard이므로 별도 cast 불필요.
 */
export function toEventSentiment(value: unknown): NewsSentiment | null {
    return isNewsSentiment(value) ? value : null;
}
