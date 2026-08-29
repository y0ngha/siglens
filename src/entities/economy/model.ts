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
    /**
     * 사이드카(`content_translations`)에 요청 로케일 번역이 **있을 때만** 채워진다.
     * 없으면 부재이고, 그때는 한국어 원문을 쓴다 — 빈 카드보다 낫다.
     * 읽는 쪽은 `resolveCalendarSummary`/`resolveCalendarInterpretation`.
     */
    summaryLocalized?: string;
    interpretationLocalized?: string;
}

/**
 * 표시 결정용 최소 구조.
 *
 * `EconomicCalendarEventWithAnalysis`를 통째로 받으면 그리드처럼 `analyzedAt`을
 * 떼어낸 축약 타입이 안 들어간다 — 그 필드는 클라이언트가 안 쓰므로 페이로드에서
 * 실제로 제거된다(`economy/page.tsx`의 `calendarEventsForClient`).
 */
interface CalendarSummarySource {
    summaryKo?: string | null;
    summaryLocalized?: string;
}

interface CalendarInterpretationSource {
    interpretationKo?: string | null;
    interpretationLocalized?: string;
}

/** 캘린더 요약 표시 언어 결정 — 사이드카가 있으면 이긴다. */
export function resolveCalendarSummary(
    event: CalendarSummarySource
): string | null {
    return event.summaryLocalized ?? event.summaryKo ?? null;
}

/** 캘린더 해석 표시 언어 결정 — `resolveCalendarSummary`와 같은 규칙. */
export function resolveCalendarInterpretation(
    event: CalendarInterpretationSource
): string | null {
    return event.interpretationLocalized ?? event.interpretationKo ?? null;
}
