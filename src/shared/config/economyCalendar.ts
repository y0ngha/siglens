/**
 * SiglensAI `get_economy` 캘린더 창 상수. 도구(`app/api/ai/chat/tools/getEconomy.ts`)와 `/developers`의 도구 요약
 * 문구(ICU 인자, `views.developers.tools.summaries.get_economy`)가 같은 값을 읽는다(CONVENTIONS.md#I18-6).
 */

/**
 * 인자 없는 호출이 읽는 기간(오늘 ET부터, 일). FOMC 회의 간격은 최장 8주(56일, 2023-07-26 → 09-20)라
 * 다음 금리 결정이 늘 이 안에 든다. 주 단위로 나눠떨어지게 둔다 — 요약 문구가 주로 말한다.
 */
export const ECONOMY_CALENDAR_DEFAULT_DAYS = 70;

/**
 * FMP economic-calendar는 `to`로부터 이 일수만 돌려주고, 더 긴 범위는 200으로 앞쪽 날짜를 조용히
 * 버린다(2026-10-23 실측: `to=2027-03-31`은 `from`과 무관하게 2026-12-31부터). 버려진 구간은 "일정
 * 없음"으로 읽힌다.
 */
export const FMP_CALENDAR_MAX_SPAN_DAYS = 90;

/**
 * FMP는 UTC 날짜로 거르는데 사용자의 하루는 UTC 이틀에 걸친다(KST 03:00 FOMC = 전날 18:00 UTC).
 * 그래서 읽기를 앞뒤로 이 일수만큼 넓힌다.
 */
export const ECONOMY_CALENDAR_FETCH_PAD_DAYS = 1;

/** 기간 조회(`from`/`to`)의 최장 일수 — 넓힌 읽기가 FMP의 일수 안에 들어야 한다. */
export const ECONOMY_CALENDAR_MAX_RANGE_DAYS =
    FMP_CALENDAR_MAX_SPAN_DAYS - 2 * ECONOMY_CALENDAR_FETCH_PAD_DAYS;
