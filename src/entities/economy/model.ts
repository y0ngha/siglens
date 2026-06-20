import type {
    EconomicCalendarEvent,
    NewsSentiment,
} from '@y0ngha/siglens-core';

/**
 * 표시 계층용 캘린더 이벤트 + (선택) AI 분석. SP-A `EconomicCalendarEvent`에
 * SP-D 분석 필드를 합성한 view 타입이다. `sentiment`는 읽기 경계에서 검증된
 * `NewsSentiment | null`(`toEventSentiment`), 요약/해석은 미분석이면 null.
 *
 * 미발표/Low/미분석 이벤트는 세 필드가 모두 null이라 기존 표시와 동일하게 렌더된다.
 */
export interface EconomicCalendarEventWithAnalysis extends EconomicCalendarEvent {
    sentiment: NewsSentiment | null;
    summaryKo: string | null;
    interpretationKo: string | null;
    analyzedAt: Date | null;
}
